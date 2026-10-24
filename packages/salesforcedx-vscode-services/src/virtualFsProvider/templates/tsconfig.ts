/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
export const tsconfig = [
  '{',
  '	"compilerOptions": {',
  '		"target": "es2024",',
  '		"lib": ["es2024", "dom"],',
  '		"module": "nodenext",',
  '		"moduleResolution": "nodenext",',
  '		"outDir": "./dist",',
  '		"rootDir": "./",',
  '		"strict": true,',
  '		"esModuleInterop": true,',
  '		"skipLibCheck": true,',
  '		"forceConsistentCasingInFileNames": true',
  '	},',
  '	"include": ["force-app/**/*", "scripts/**/*"],',
  '	"exclude": ["node_modules", "**/*.spec.ts"]',
  '}'
];
