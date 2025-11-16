import { format, parse } from '#markdoc';
import { expect, test } from '@jest/globals';
import path from 'node:path';
import { fileURLToPath } from 'url';
import keystaticConfig, {
  components,
} from '../../../../../../../../docs/keystatic.config';
import { createReader } from '../../../../../reader';
import { editorOptionsToConfig } from '../../config';
import { markdocToProseMirror } from '../markdoc/parse';
import { proseMirrorToMarkdoc } from '../markdoc/serialize';
import { createEditorSchema } from '../schema';

test('docs serialisation', async () => {
  const docsPath = path.resolve(
    fileURLToPath(import.meta.url),
    '../../../../../../../../../docs'
  );
  const reader = createReader(docsPath, keystaticConfig);

  const result = await reader.collections.pages.all({
    resolveLinkedFiles: true,
  });
  expect(result.length).toBeGreaterThan(0);
  const schema = createEditorSchema(
    editorOptionsToConfig({}),
    components,
    false
  );

  for (const page of result) {
    try {
      for (const node of page.entry.content.node.walk()) {
        if (node.type === 'em' || node.type === 'strong') {
          delete node.attributes.marker;
        }
      }
      const formatted = format(parse(format(page.entry.content.node)));
      const prosemirror = markdocToProseMirror(
        parse(formatted),
        schema,
        new Map(),
        new Map(),
        page.slug
      );
      const markdoc = proseMirrorToMarkdoc(prosemirror, {
        extraFiles: new Map(),
        otherFiles: new Map(),
        schema,
        slug: page.slug,
      });
      expect(format(parse(format(markdoc)))).toBe(formatted);
    } catch (cause) {
      throw new Error(`Error in ${page.slug}`, { cause });
    }
  }
});
