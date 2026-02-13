/**
 * ChatPanel Component - Room chat sidebar
 *
 * Features:
 * - Scrolling message list with auto-scroll to bottom
 * - Message input with send button
 * - Display name, content, and timestamp per message
 * - System messages styled differently (gray, italic)
 * - Uses roomStore.messages and roomStore.addMessage
 */

import { useState, useRef, useEffect } from 'react';
import { Send } from 'lucide-react';
import { cn } from '../../utils/cn';
import { useRoomStore } from '../../stores/roomStore';
import { useAuthStore } from '../../stores/authStore';

function ChatPanel() {
  const messages = useRoomStore((state) => state.messages);
  const addMessage = useRoomStore((state) => state.addMessage);
  const user = useAuthStore((state) => state.user);

  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    const content = inputValue.trim();
    if (!content) return;

    addMessage({
      userId: user?.id || 'unknown',
      displayName: user?.displayName || user?.name || 'You',
      content,
      type: 'text',
    });

    setInputValue('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatTime = (date: Date) => {
    return new Date(date).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="flex flex-col h-full bg-gray-800">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-700">
        <h3 className="text-sm font-semibold text-white">Chat</h3>
        <p className="text-xs text-gray-500">{messages.length} messages</p>
      </div>

      {/* Messages */}
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto px-4 py-3 space-y-3"
      >
        {messages.length === 0 && (
          <div className="text-center py-8">
            <p className="text-sm text-gray-500">
              No messages yet. Start the conversation!
            </p>
          </div>
        )}

        {messages.map((message) => {
          const isSystem = message.type === 'system' || message.type === 'alert';
          const isOwn = message.userId === user?.id;

          if (isSystem) {
            return (
              <div key={message.id} className="text-center py-1">
                <p className="text-xs text-gray-500 italic">
                  {message.content}
                </p>
              </div>
            );
          }

          return (
            <div key={message.id} className="group">
              <div className="flex items-baseline gap-2 mb-0.5">
                <span
                  className={cn(
                    'text-sm font-medium',
                    isOwn ? 'text-blue-400' : 'text-gray-300'
                  )}
                >
                  {message.displayName}
                </span>
                <span className="text-xs text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity">
                  {formatTime(message.createdAt)}
                </span>
              </div>
              <p className="text-sm text-gray-300 break-words">
                {message.content}
              </p>
            </div>
          );
        })}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-gray-700">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            className="flex-1 px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <button
            onClick={handleSend}
            disabled={!inputValue.trim()}
            className="p-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default ChatPanel;
