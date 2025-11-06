import {
  MessageSquarePlus,
  Search,
  Trash2,
  Undo2,
  EllipsisVertical,
  Pencil,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  useSidebar,
} from '@/components/ui/sidebar';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { api, Conversation } from '@/lib/api';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface ChatSidebarProps {
  selectedChatId?: string;
  onChatSelect?: (chatId: string) => void;
  onNewChat?: () => void;
}

interface DeleteState {
  conversationId: string;
  conversation: Conversation;
  timeoutId: NodeJS.Timeout;
}

export function ChatSidebar({
  selectedChatId,
  onChatSelect,
  onNewChat,
}: ChatSidebarProps) {
  const queryClient = useQueryClient();
  const { isMobile, setOpenMobile } = useSidebar();
  const [deleteState, setDeleteState] = useState<DeleteState | null>(null);
  const deleteStateRef = useRef<DeleteState | null>(null);
  const deleteTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [editingConversationId, setEditingConversationId] = useState<
    string | null
  >(null);
  const [editTitle, setEditTitle] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch conversations
  const { data: conversations = [], isLoading } = useQuery({
    queryKey: ['conversations'],
    queryFn: () => api.listConversations(),
  });

  // Create new conversation
  const createMutation = useMutation({
    mutationFn: () => api.createConversation(),
    onSuccess: (newConversation) => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      onChatSelect?.(newConversation.id);
      // Reason: Close sidebar on mobile after creating a new chat
      if (isMobile) {
        setOpenMobile(false);
      }
    },
    onError: (error: Error) => {
      toast.error('Failed to create conversation', {
        description: error.message,
      });
    },
  });

  // Update conversation title
  const updateMutation = useMutation({
    mutationFn: ({ id, title }: { id: string; title: string }) =>
      api.updateConversation(id, title),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      queryClient.invalidateQueries({
        queryKey: ['conversation', selectedChatId],
      });
      setEditingConversationId(null);
      setEditTitle('');
      toast.success('Conversation title updated');
    },
    onError: (error: Error) => {
      toast.error('Failed to update conversation title', {
        description: error.message,
      });
    },
  });

  // Delete conversation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteConversation(id),
    onSuccess: (_, deletedId) => {
      // Reason: Remove from UI after successful backend deletion
      queryClient.setQueryData<Conversation[]>(['conversations'], (old) => {
        if (!old) return old;
        return old.filter((c) => c.id !== deletedId);
      });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      // Reason: Clear delete state if this was the conversation being deleted
      if (deleteStateRef.current?.conversationId === deletedId) {
        clearTimeout(deleteStateRef.current.timeoutId);
        setDeleteState(null);
        deleteStateRef.current = null;
      }
    },
    onError: (error: Error, deletedId) => {
      toast.error('Failed to delete conversation', {
        description: error.message,
      });
      // Restore conversation on error if this was the one being deleted
      if (deleteStateRef.current?.conversationId === deletedId) {
        handleUndoDelete();
      }
    },
  });

  const handleDelete = (conversation: Conversation, e: React.MouseEvent) => {
    e.stopPropagation();

    // Clear any existing timeout
    if (deleteTimeoutRef.current) {
      clearTimeout(deleteTimeoutRef.current);
    }

    // Reason: If this was the selected conversation, clear selection
    if (selectedChatId === conversation.id) {
      onChatSelect?.(
        conversations.find((c) => c.id !== conversation.id)?.id || ''
      );
    }

    // Set up undo timeout (5 seconds)
    const timeoutId = setTimeout(() => {
      // Actually delete from backend
      deleteMutation.mutate(conversation.id);
    }, 5000);

    const newDeleteState = {
      conversationId: conversation.id,
      conversation,
      timeoutId,
    };
    setDeleteState(newDeleteState);
    deleteStateRef.current = newDeleteState;
    deleteTimeoutRef.current = timeoutId;

    // Reason: Capture conversation ID in closure to ensure undo works from toast
    const conversationIdToUndo = conversation.id;
    toast.info('Conversation deleted', {
      description: 'Undo to restore',
      action: {
        label: 'Undo',
        onClick: () => {
          // Reason: Use ref to access current delete state, not stale closure
          if (deleteStateRef.current?.conversationId === conversationIdToUndo) {
            handleUndoDelete();
          }
        },
      },
      duration: 5000,
    });
  };

  const handleUndoDelete = () => {
    // Reason: Use ref to access current delete state, avoiding stale closure issues
    const currentDeleteState = deleteStateRef.current;
    if (!currentDeleteState) return;

    clearTimeout(currentDeleteState.timeoutId);
    if (deleteTimeoutRef.current) {
      clearTimeout(deleteTimeoutRef.current);
    }

    // Reason: Conversation is still in the list, just clear the delete state
    // No need to restore since we never removed it optimistically
    setDeleteState(null);
    deleteStateRef.current = null;
    toast.success('Conversation restored');
  };

  const handleNewChatClick = () => {
    createMutation.mutate();
    onNewChat?.();
  };

  const handleEditClick = (conversation: Conversation, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditTitle(conversation.title);
    setEditingConversationId(conversation.id);
  };

  const handleSaveEdit = () => {
    if (!editingConversationId || !editTitle.trim()) return;
    updateMutation.mutate({
      id: editingConversationId,
      title: editTitle.trim(),
    });
  };

  const handleCancelEdit = () => {
    setEditingConversationId(null);
    setEditTitle('');
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (deleteTimeoutRef.current) {
        clearTimeout(deleteTimeoutRef.current);
      }
    };
  }, []);

  const formatTimestamp = (dateString: string | null) => {
    if (!dateString) return 'No messages';
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: true });
    } catch {
      return 'Unknown';
    }
  };

  // Reason: Filter conversations based on search query
  const filteredConversations = conversations.filter((chat) =>
    chat.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Sidebar className="border-r border-sidebar-border">
      <SidebarHeader className="p-4 space-y-3">
        <Button
          onClick={handleNewChatClick}
          disabled={createMutation.isPending}
          className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-medium"
          aria-label="Start new conversation"
        >
          <MessageSquarePlus className="mr-2 h-4 w-4" />
          {createMutation.isPending ? 'Creating...' : 'New Chat'}
        </Button>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search chats..."
            className="pl-9 bg-sidebar-accent border-sidebar-border focus-visible:ring-primary"
            aria-label="Search conversations"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </SidebarHeader>

      <SidebarContent>
        <ScrollArea className="flex-1">
          {isLoading ? (
            <div className="p-4 text-sm text-muted-foreground text-center">
              Loading conversations...
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground text-center">
              {searchQuery
                ? 'No conversations match your search.'
                : 'No conversations yet. Start a new chat to begin!'}
            </div>
          ) : (
            <SidebarMenu>
              {filteredConversations.map((chat) => {
                const isDeleting = deleteState?.conversationId === chat.id;

                return (
                  <SidebarMenuItem key={chat.id}>
                    <div className="group relative flex items-center w-full">
                      <SidebarMenuButton
                        onClick={() => {
                          // Reason: Prevent selecting conversation while it's being deleted
                          if (isDeleting) return;
                          onChatSelect?.(chat.id);
                          // Reason: Close sidebar on mobile after selecting a chat
                          if (isMobile) {
                            setOpenMobile(false);
                          }
                        }}
                        isActive={selectedChatId === chat.id && !isDeleting}
                        className="flex-1 px-3 py-8 hover:bg-sidebar-accent rounded-none transition-colors data-[active=true]:bg-sidebar-accent"
                        aria-label={`Select conversation: ${chat.title}`}
                      >
                        <div className="flex flex-col items-start gap-1 w-full pr-8">
                          <span
                            className={cn(
                              'font-medium text-sm truncate w-full ',
                              isDeleting
                                ? 'text-sidebar-foreground/50'
                                : 'text-sidebar-foreground'
                            )}
                          >
                            {chat.title}
                          </span>
                          <span
                            className={cn(
                              'text-xs text-muted-foreground',
                              isDeleting
                                ? 'text-muted-foreground/50'
                                : 'text-muted-foreground'
                            )}
                          >
                            {formatTimestamp(
                              chat.lastMessageAt || chat.createdAt
                            )}
                          </span>
                        </div>
                      </SidebarMenuButton>

                      {isDeleting ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleUndoDelete();
                          }}
                          className="absolute right-2 h-8 w-8 text-primary hover:text-primary opacity-100"
                          aria-label="Undo delete"
                        >
                          <Undo2 className="h-4 w-4" />
                        </Button>
                      ) : (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => e.stopPropagation()}
                              className="absolute right-2 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                              aria-label={`Options for conversation: ${chat.title}`}
                            >
                              <EllipsisVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent
                            align="end"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <DropdownMenuItem
                              onClick={(e) => handleEditClick(chat, e)}
                            >
                              <Pencil className="mr-2 h-4 w-4" />
                              Rename
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={(e) => handleDelete(chat, e)}
                              className="text-destructive focus:text-white"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          )}
        </ScrollArea>
      </SidebarContent>

      {/* Edit Conversation Title Dialog */}
      <Dialog
        open={editingConversationId !== null}
        onOpenChange={(open) => !open && handleCancelEdit()}
      >
        <DialogContent onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>Rename Conversation</DialogTitle>
            <DialogDescription>
              Enter a new title for this conversation.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              placeholder="Conversation title"
              maxLength={200}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleSaveEdit();
                } else if (e.key === 'Escape') {
                  handleCancelEdit();
                }
              }}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCancelEdit}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveEdit}
              disabled={!editTitle.trim() || updateMutation.isPending}
            >
              {updateMutation.isPending ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Sidebar>
  );
}
