import { jsonLanguage } from '@codemirror/lang-json';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { EditorView } from '@codemirror/view';
import { tags as t } from '@lezer/highlight';
import { draculaInit } from '@uiw/codemirror-theme-dracula';
import CodeMirror from '@uiw/react-codemirror';
import { HTMLAttributes, useMemo } from 'react';
import { cn } from '@/lib/utils';

import type { Extension } from '@codemirror/state';

import { CopyButton } from '@/ds/components/CopyButton';

export type CodeEditorLanguage = 'json' | 'markdown';

export const useCodemirrorTheme = (): Extension => {
  return useMemo(() => {
    const baseTheme = draculaInit({
      settings: {
        fontFamily: 'var(--geist-mono)',
        fontSize: '0.8rem',
        lineHighlight: 'transparent',
        gutterBackground: 'transparent',
        gutterForeground: '#939393',
        background: 'transparent',
      },
      styles: [{ tag: [t.className, t.propertyName] }],
    });

    const customLineNumberTheme = EditorView.theme({
      '.cm-editor': {
        colorScheme: 'dark',
        backgroundColor: 'transparent',
      },
      '.cm-lineNumbers .cm-gutterElement': {
        color: '#939393',
      },
    });

    return [baseTheme, customLineNumberTheme];
  }, []);
};

const getLanguageExtension = (language: CodeEditorLanguage): Extension => {
  switch (language) {
    case 'markdown':
      return markdown({ base: markdownLanguage });
    case 'json':
    default:
      return jsonLanguage;
  }
};

export type CodeEditorProps = {
  data?: Record<string, unknown> | Array<Record<string, unknown>>;
  value?: string;
  onChange?: (value: string) => void;
  showCopyButton?: boolean;
  className?: string;
  language?: CodeEditorLanguage;
  placeholder?: string;
} & Omit<HTMLAttributes<HTMLDivElement>, 'onChange'>;

export const CodeEditor = ({
  data,
  value,
  onChange,
  showCopyButton = true,
  className,
  language = 'json',
  placeholder,
  ...props
}: CodeEditorProps) => {
  const theme = useCodemirrorTheme();
  const formattedCode = data ? JSON.stringify(data, null, 2) : (value ?? '');
  const languageExtension = useMemo(() => getLanguageExtension(language), [language]);

  return (
    <div className={cn('rounded-md bg-surface4 p-1 font-mono relative', className)} {...props}>
      {showCopyButton && <CopyButton content={formattedCode} className="absolute top-2 right-2 z-20" />}
      <CodeMirror
        value={formattedCode}
        theme={theme}
        extensions={[languageExtension]}
        onChange={onChange}
        aria-label="Code editor"
        placeholder={placeholder}
      />
    </div>
  );
};

export async function highlight(code: string, language: string) {
  const { codeToTokens, bundledLanguages } = await import('shiki');

  if (!(language in bundledLanguages)) return null;

  const { tokens } = await codeToTokens(code, {
    lang: language as keyof typeof bundledLanguages,
    defaultColor: false,
    themes: {
      light: 'github-light',
      dark: 'github-dark',
    },
  });

  return tokens;
}
