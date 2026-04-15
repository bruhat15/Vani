import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { User, LogOut, Moon, Sun } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useNotebookUpdate } from '@/hooks/useNotebookUpdate';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useLogout } from '@/services/authService';
import Logo from '@/components/ui/Logo';
import { useVaniAppStore } from '@/stores/appStore';

interface NotebookHeaderProps {
  title: string;
  notebookId?: string;
}

const NotebookHeader = ({ title, notebookId }: NotebookHeaderProps) => {
  const navigate = useNavigate();
  const { logout } = useLogout();
  const [isEditing, setIsEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState(title);
  const { updateNotebook, isUpdating } = useNotebookUpdate();
  const theme = useVaniAppStore((state) => state.theme);
  const toggleTheme = useVaniAppStore((state) => state.toggleTheme);

  const handleTitleClick = () => {
    if (notebookId) {
      setIsEditing(true);
      setEditedTitle(title);
    }
  };

  const handleTitleSubmit = () => {
    if (notebookId && editedTitle.trim() && editedTitle !== title) {
      updateNotebook({
        id: notebookId,
        updates: { title: editedTitle.trim() }
      });
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleTitleSubmit();
    } else if (e.key === 'Escape') {
      setEditedTitle(title);
      setIsEditing(false);
    }
  };

  const handleBlur = () => {
    handleTitleSubmit();
  };

  const handleIconClick = () => {
    navigate('/');
  };

  return (
    <header className="border-b border-gray-200 bg-white px-6 py-4 dark:border-gray-800 dark:bg-slate-950">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <button 
              onClick={handleIconClick}
              className="rounded p-1 transition-colors hover:bg-gray-50 dark:hover:bg-slate-800"
            >
              <Logo />
            </button>
            {isEditing ? (
              <Input
                value={editedTitle}
                onChange={(e) => setEditedTitle(e.target.value)}
                onKeyDown={handleKeyDown}
                onBlur={handleBlur}
                className="h-auto w-auto min-w-[300px] border-none p-0 text-lg font-medium text-gray-900 shadow-none focus-visible:ring-0 dark:text-slate-100"
                autoFocus
                disabled={isUpdating}
              />
            ) : (
              <span 
                className="cursor-pointer rounded px-2 py-1 text-lg font-medium text-gray-900 transition-colors hover:bg-gray-50 dark:text-slate-100 dark:hover:bg-slate-800"
                onClick={handleTitleClick}
              >
                {title}
              </span>
            )}
          </div>
        </div>
        
        <div className="flex items-center space-x-4">
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>

          <div className="flex items-center space-x-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="p-0">
                  <div className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-purple-500 transition-colors hover:bg-purple-600">
                    <User className="h-4 w-4 text-white" />
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={logout} className="cursor-pointer">
                  <LogOut className="h-4 w-4 mr-2" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </header>
  );
};

export default NotebookHeader;
