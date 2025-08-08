import { join } from "@std/path";

import { ISSUE_FORMAT_HEADER, getRepoSlug } from "../types/constants.ts";
import { Issue, DraftIssue } from "../types/issue.ts";

import { readTextFileSafe, writeTextFileSafe } from "./file-operations.ts";
import { pathResolver } from "./path-resolver.ts";

/**
 * リポジトリ名からファイルパスを取得
 */
export async function getIssueFilePath(repoFullName: string): Promise<string> {
  const slug = await getRepoSlug(repoFullName);
  return pathResolver.resolve(join('_llm-memories', 'issues', `${slug}.md`));
}

/**
 * ファイルから既存のDRAFTセクションを読み込む
 */
export async function loadExistingDrafts(repoFullName: string): Promise<DraftIssue[]> {
  const filePath = await getIssueFilePath(repoFullName);
  const content = await readTextFileSafe(filePath);
  
  if (!content) {
    console.warn(`No content found in file: ${filePath}`);
    return [];
  }
  
  const drafts: DraftIssue[] = [];
  const lines = content.split('\n');
  
  let inDraftSection = false;
  let currentDraft: DraftIssue | null = null;
  let inDetailsSection = false;
  let detailsContent: string[] = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    if (line.includes('## DRAFT Issues')) {
      inDraftSection = true;
      continue;
    }
    if (line.startsWith('## ') && inDraftSection) {
      // セクション終了時に未完了のdraftを追加
      if (currentDraft) {
        if (detailsContent.length > 0) {
          currentDraft.body = detailsContent.join('\n').trim();
        }
        drafts.push(currentDraft);
        currentDraft = null;
        detailsContent = [];
      }
      inDraftSection = false;
      break;
    }
    
    if (inDraftSection) {
      if (line.startsWith('- #-')) {
        // 前のdraftを完了
        if (currentDraft) {
          if (detailsContent.length > 0) {
            currentDraft.body = detailsContent.join('\n').trim();
          }
          drafts.push(currentDraft);
          detailsContent = [];
        }
        
        // 新しいdraftを開始
        // フォーマット: #番号 | タイトル | label | category | priority | section | 状態
        const match = line.match(/^- #- \| ([^|]+) \| ([^|]*) \| ([^|]*) \| ([^|]*) \| ([^|]*) \| DRAFT/);
        if (match) {
          try {
            const labelValue = match[2].trim();
            const categoryValue = match[3].trim();
            const priorityValue = match[4].trim();
            const sectionValue = match[5].trim();
            
            currentDraft = {
              title: match[1].trim(),
              label: labelValue || '',
              category: categoryValue && ['structure', 'frontend', 'backend', 'infrastructure'].includes(categoryValue) 
                ? categoryValue as any : undefined,
              priority: priorityValue && ['Critical', 'High', 'Medium', 'Low'].includes(priorityValue) 
                ? priorityValue as any : undefined,
              section: sectionValue || undefined,
              state: "DRAFT",
              repo: repoFullName
            };
            inDetailsSection = false;
            console.log(`Parsed DRAFT: ${currentDraft?.title || '不明'}`);
          } catch (error) {
            console.error(`Error parsing DRAFT: ${line}`, error);
          }
        }
      } else if (currentDraft && line.trim() === '<details>') {
        inDetailsSection = true;
      } else if (currentDraft && line.trim() === '</details>') {
        inDetailsSection = false;
      } else if (currentDraft && inDetailsSection && !line.includes('<summary>')) {
        // details内のコンテンツを収集（インデントを除去）
        const cleanLine = line.replace(/^  /, '');
        if (cleanLine.trim()) {
          detailsContent.push(cleanLine);
        }
      }
    }
  }
  
  // 最後のdraftを追加
  if (currentDraft) {
    if (detailsContent.length > 0) {
      currentDraft.body = detailsContent.join('\n').trim();
    }
    drafts.push(currentDraft);
  }
  
  return drafts;
}

/**
 * ファイルからIssueリストを読み込む（DRAFT含む）
 */
export async function loadIssuesFromFile(repoFullName: string): Promise<Issue[]> {
  const filePath = await getIssueFilePath(repoFullName);
  const content = await readTextFileSafe(filePath);
  
  if (!content) {
    return [];
  }
  
  const issues: Issue[] = [];
  const lines = content.split('\n');
  
  let currentSection: "DRAFT" | "OPEN" | "CLOSED" | null = null;
  
  for (const line of lines) {
    if (line.includes('## DRAFT Issues')) {
      currentSection = 'DRAFT';
      continue;
    }
    if (line.includes('## OPEN Issues')) {
      currentSection = 'OPEN';
      continue;
    }
    if (line.includes('## CLOSED Issues')) {
      currentSection = 'CLOSED';
      continue;
    }
    
    // リスト形式の解析
    if (line.startsWith('- #')) {
      let match: RegExpMatchArray | null;
      
      if (currentSection === 'DRAFT') {
        match = line.match(/^- #- \| ([^|]+) \| ([^|]+) \| DRAFT/);
        if (match) {
          issues.push({
            number: null,
            title: match[1].trim(),
            state: 'DRAFT',
            repo: repoFullName,
            labels: match[2].trim().split(',').map(l => l.trim()).filter(l => l !== '-')
          });
        }
      } else {
        match = line.match(/^- #(\d+) \| ([^|]+) \| ([^|]+) \| (OPEN|CLOSED)/);
        if (match) {
          issues.push({
            number: parseInt(match[1]),
            title: match[2].trim(),
            state: match[4] as "OPEN" | "CLOSED",
            repo: repoFullName,
            labels: match[3].trim().split(',').map(l => l.trim()).filter(l => l !== '-')
          });
        }
      }
    }
  }
  
  return issues;
}

/**
 * Issueリストファイルを更新（リポジトリ別）
 */
export async function updateIssueListFile(
  issues: Issue[],
  repoFullName: string,
  drafts?: DraftIssue[]
): Promise<boolean> {
  const filePath = await getIssueFilePath(repoFullName);
  
  // draftsが指定されない場合は既存のものを使用
  const existingDrafts = drafts || await loadExistingDrafts(repoFullName);
  
  const openIssues = issues.filter(i => i.state === 'OPEN').sort((a, b) => (b.number || 0) - (a.number || 0));
  const closedIssues = issues.filter(i => i.state === 'CLOSED').sort((a, b) => (b.number || 0) - (a.number || 0));
  
  let content = `# ${repoFullName} Issue List\n\n`;
  content += `${ISSUE_FORMAT_HEADER}\n`;
  content += '```\n\n';
  
  // DRAFT Issues
  if (existingDrafts.length > 0) {
    content += '## DRAFT Issues\n\n';
    existingDrafts.forEach(draft => {
      // フォーマットで出力
      const label = draft.label || '';
      const category = draft.category || '';
      const priority = draft.priority || '';
      const section = draft.section || '';
      content += `- #- | ${draft.title} | ${label} | ${category} | ${priority} | ${section} | DRAFT\n`;
      // bodyがある場合は詳細セクションとして追加
      if (draft.body) {
        content += `  <details>\n  <summary>Issue詳細</summary>\n\n${draft.body.split('\n').map(line => `  ${line}`).join('\n')}\n\n  </details>\n`;
      }
    });
    content += '\n';
  }
  
  // OPEN Issues
  if (openIssues.length > 0) {
    content += '## OPEN Issues\n\n';
    openIssues.forEach(issue => {
      const labels = issue.labels ? issue.labels.join(',') : '';
      const category = issue.category || '';
      const priority = issue.priority || '';
      const section = issue.section || '';
      content += `- #${issue.number} | ${issue.title} | ${labels} | ${category} | ${priority} | ${section} | OPEN\n`;
    });
    content += '\n';
  }
  
  // CLOSED Issues
  if (closedIssues.length > 0) {
    content += '## CLOSED Issues\n\n';
    closedIssues.forEach(issue => {
      const labels = issue.labels ? issue.labels.join(',') : '';
      const category = issue.category || '';
      const priority = issue.priority || '';
      const section = issue.section || '';
      content += `- #${issue.number} | ${issue.title} | ${labels} | ${category} | ${priority} | ${section} | CLOSED\n`;
    });
    content += '\n';
  }
  
  return await writeTextFileSafe(filePath, content);
}

/**
 * DRAFTを既存ファイルに追加
 */
export async function addDraftToFile(
  repoFullName: string,
  newDrafts: DraftIssue[]
): Promise<boolean> {
  const filePath = await getIssueFilePath(repoFullName);
  const content = await readTextFileSafe(filePath);
  
  if (!content) {
    console.error(`File ${filePath} does not exist`);
    return false;
  }
  
  const lines = content.split('\n');
  
  // 既存のDRAFTセクションを探す
  let draftSectionIndex = -1;
  let nextSectionIndex = -1;
  
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('## DRAFT Issues')) {
      draftSectionIndex = i;
    } else if (draftSectionIndex !== -1 && lines[i].startsWith('## ')) {
      nextSectionIndex = i;
      break;
    }
  }
  
  // 新しいDRAFTエントリを作成
  const draftLines = newDrafts.map(draft => {
    // フォーマットで出力
    const label = draft.label || '';
    const category = draft.category || '';
    const priority = draft.priority || '';
    const section = draft.section || '';
    return `- #- | ${draft.title} | ${label} | ${category} | ${priority} | ${section} | DRAFT`;
  });
  
  let newContent: string;
  
  if (draftSectionIndex === -1) {
    // DRAFTセクションが存在しない場合、最初のセクションの前に追加
    const firstSectionIndex = lines.findIndex(line => line.startsWith('## '));
    
    if (firstSectionIndex === -1) {
      // セクションがない場合、ファイル末尾に追加
      newContent = content + '\n## DRAFT Issues\n\n' + draftLines.join('\n') + '\n';
    } else {
      // 最初のセクションの前に挿入
      const beforeSection = lines.slice(0, firstSectionIndex);
      const afterSection = lines.slice(firstSectionIndex);
      
      newContent = beforeSection.join('\n') + '\n## DRAFT Issues\n\n' + 
                   draftLines.join('\n') + '\n\n' + afterSection.join('\n');
    }
  } else {
    // DRAFTセクションが存在する場合、その中に追加
    const beforeDraft = lines.slice(0, draftSectionIndex + 1);
    const afterDraft = nextSectionIndex === -1 ? [] : lines.slice(nextSectionIndex);
    
    // 既存のDRAFTエントリを保持
    const existingDraftLines: string[] = [];
    for (let i = draftSectionIndex + 1; i < (nextSectionIndex === -1 ? lines.length : nextSectionIndex); i++) {
      if (lines[i].startsWith('- #-')) {
        existingDraftLines.push(lines[i]);
      }
    }
    
    const allDraftLines = [...existingDraftLines, ...draftLines];
    
    newContent = beforeDraft.join('\n') + '\n\n' + 
                 allDraftLines.join('\n') + '\n\n' + 
                 (afterDraft.length > 0 ? afterDraft.join('\n') : '');
  }
  
  return await writeTextFileSafe(filePath, newContent);
}