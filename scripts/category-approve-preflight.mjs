#!/usr/bin/env node
import { appendFile, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { categoryPullNumbers, createCategoryReads, readCategoryFacts } from './shared/categoryReads.mts';

export const preflight = async (event, owner, repo, token, runId) => {
  if (event.check_run?.name === 'category-approve') return false;
  const reads = createCategoryReads(token);
  const numbers = await categoryPullNumbers(reads, event, owner, repo);
  if (numbers.length === 0) return false;
  const results = await Promise.all(numbers.map(number => readCategoryFacts(reads, owner, repo, number, runId)));
  results.forEach(({ decision }, index) => console.log(`#${numbers[index]} ${decision._tag} (${decision.reason})`));
  return results.some(({ decision }) => decision._tag !== 'Skip');
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const token = process.env.IDEE_GH_TOKEN;
  if (!token) throw new Error('IDEE_GH_TOKEN is required');
  const event = JSON.parse(await readFile(process.env.GITHUB_EVENT_PATH, 'utf8'));
  const [owner, repo] = process.env.GITHUB_REPOSITORY.split('/');
  const shouldRun = await preflight(event, owner, repo, token, process.env.GITHUB_RUN_ID);
  await appendFile(process.env.GITHUB_OUTPUT, `run=${shouldRun}\n`);
}
