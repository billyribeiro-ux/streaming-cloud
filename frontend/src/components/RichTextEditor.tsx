/**
 * RichTextEditor Component - Simple rich text editor
 *
 * Features:
 * - Toolbar with bold, italic, underline, link buttons
 * - Uses contentEditable div (no heavy deps)
 * - Supports basic formatting via document.execCommand
 */

import { useRef, useCallback, useEffect, useState } from 'react';
import { Bold, Italic, Underline, Link as LinkIcon } from 'lucide-react';
import { cn } from '../utils/cn';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

interface ToolbarButton {
  command: string;
  icon: React.ElementType;
  label: string;
}

const toolbarButtons: ToolbarButton[] = [
  { command: 'bold', icon: Bold, label: 'Bold' },
  { command: 'italic', icon: Italic, label: 'Italic' },
  { command: 'underline', icon: Underline, label: 'Underline' },
];

export default function RichTextEditor({
  value,
  onChange,
  placeholder = 'Start typing...',
  className,
}: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [isFocused, setIsFocused] = useState(false);
  const isInternalUpdate = useRef(false);

  // Sync external value changes into the editor
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    // Only update if the value actually differs and it was not our own edit
    if (!isInternalUpdate.current && editor.innerHTML !== value) {
      editor.innerHTML = value;
    }
    isInternalUpdate.current = false;
  }, [value]);

  const handleInput = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;

    isInternalUpdate.current = true;
    onChange(editor.innerHTML);
  }, [onChange]);

  const execCommand = useCallback((command: string) => {
    document.execCommand(command, false);
    editorRef.current?.focus();
  }, []);

  const handleInsertLink = useCallback(() => {
    const url = prompt('Enter URL:');
    if (url) {
      document.execCommand('createLink', false, url);
      editorRef.current?.focus();
    }
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // Keyboard shortcuts
      if (e.metaKey || e.ctrlKey) {
        switch (e.key.toLowerCase()) {
          case 'b':
            e.preventDefault();
            execCommand('bold');
            break;
          case 'i':
            e.preventDefault();
            execCommand('italic');
            break;
          case 'u':
            e.preventDefault();
            execCommand('underline');
            break;
          case 'k':
            e.preventDefault();
            handleInsertLink();
            break;
        }
      }
    },
    [execCommand, handleInsertLink]
  );

  const isEmpty = !value || value === '<br>' || value === '<div><br></div>';

  return (
    <div
      className={cn(
        'rounded-lg border border-gray-700 bg-gray-900 overflow-hidden transition-colors',
        isFocused && 'border-blue-500 ring-1 ring-blue-500/20',
        className
      )}
    >
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-gray-700 bg-gray-850">
        {toolbarButtons.map((btn) => {
          const Icon = btn.icon;
          return (
            <button
              key={btn.command}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault(); // Prevent focus loss
                execCommand(btn.command);
              }}
              className="p-1.5 rounded text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
              title={btn.label}
            >
              <Icon className="w-4 h-4" />
            </button>
          );
        })}

        <div className="w-px h-5 bg-gray-700 mx-1" />

        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            handleInsertLink();
          }}
          className="p-1.5 rounded text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
          title="Insert link (Ctrl+K)"
        >
          <LinkIcon className="w-4 h-4" />
        </button>
      </div>

      {/* Editor Area */}
      <div className="relative">
        {/* Placeholder */}
        {isEmpty && !isFocused && (
          <div className="absolute inset-0 px-4 py-3 text-gray-500 text-sm pointer-events-none">
            {placeholder}
          </div>
        )}

        <div
          ref={editorRef}
          contentEditable
          onInput={handleInput}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          onKeyDown={handleKeyDown}
          className={cn(
            'min-h-[120px] px-4 py-3 text-sm text-gray-200 outline-none',
            'prose prose-invert prose-sm max-w-none',
            '[&_a]:text-blue-400 [&_a]:underline'
          )}
          role="textbox"
          aria-multiline="true"
          aria-placeholder={placeholder}
        />
      </div>
    </div>
  );
}
