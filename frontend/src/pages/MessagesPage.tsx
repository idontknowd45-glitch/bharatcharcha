import { useState, useCallback, useEffect, useRef, memo } from 'react';
import { useInternetIdentity } from '../hooks/useInternetIdentity';
import { useGetCallerUserProfile, useGetRecentChats, useGetMessages, useSendMessage, useGetFollowing, useGetUserProfile } from '../hooks/useQueries';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Send, MessageCircle, Loader2 } from 'lucide-react';
import { Principal } from '@icp-sdk/core/principal';
import { toast } from 'sonner';

const MessageBubble = memo(({ message, isOwn, senderProfile }: any) => {
  return (
    <div className={`flex gap-2 mb-4 message-bubble-animate ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}>
      <Avatar className="h-8 w-8 flex-shrink-0">
        <AvatarImage src={senderProfile?.profilePicture || '/assets/generated/default-avatar.dim_100x100.png'} />
        <AvatarFallback>{senderProfile?.displayName?.charAt(0).toUpperCase() || '?'}</AvatarFallback>
      </Avatar>
      <div className={`flex flex-col max-w-[70%] ${isOwn ? 'items-end' : 'items-start'}`}>
        <div className={`rounded-2xl px-4 py-2 ${isOwn ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
          <p className="text-sm break-words">{message.content}</p>
        </div>
        <span className="text-xs text-muted-foreground mt-1">
          {new Date(Number(message.timestamp) / 1000000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
    </div>
  );
});

const FriendListItem = memo(({ friend, isSelected, onClick, lastMessageTime }: any) => {
  const { data: friendProfile } = useGetUserProfile(friend);

  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 p-3 rounded-lg transition-all friend-item-hover ${
        isSelected ? 'bg-primary/10 border-l-4 border-primary' : 'hover:bg-muted'
      }`}
    >
      <Avatar className="h-10 w-10 flex-shrink-0">
        <AvatarImage src={friendProfile?.profilePicture || '/assets/generated/default-avatar.dim_100x100.png'} />
        <AvatarFallback>{friendProfile?.displayName?.charAt(0).toUpperCase() || '?'}</AvatarFallback>
      </Avatar>
      <div className="flex-1 text-left overflow-hidden">
        <p className="text-sm font-medium truncate">{friendProfile?.displayName || 'Loading...'}</p>
        <p className="text-xs text-muted-foreground truncate">@{friendProfile?.username || ''}</p>
        {lastMessageTime && (
          <p className="text-xs text-muted-foreground">
            {new Date(Number(lastMessageTime) / 1000000).toLocaleDateString()}
          </p>
        )}
      </div>
    </button>
  );
});

export default function MessagesPage() {
  const { identity } = useInternetIdentity();
  const { data: userProfile, isLoading: profileLoading } = useGetCallerUserProfile();
  const { data: recentChats, isLoading: chatsLoading } = useGetRecentChats();
  const { data: following, isLoading: followingLoading } = useGetFollowing(identity?.getPrincipal());
  const [selectedFriend, setSelectedFriend] = useState<Principal | null>(null);
  const { data: messages, isLoading: messagesLoading } = useGetMessages(selectedFriend);
  const sendMessageMutation = useSendMessage();
  const [messageText, setMessageText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  const { data: selectedFriendProfile } = useGetUserProfile(selectedFriend || undefined);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const handleSendMessage = useCallback(async () => {
    if (!messageText.trim() || !selectedFriend) return;

    const content = messageText.trim();
    setMessageText('');

    try {
      await sendMessageMutation.mutateAsync({
        to: selectedFriend,
        content,
      });
    } catch (error: any) {
      toast.error(error.message || 'Failed to send message');
      setMessageText(content);
    }
  }, [messageText, selectedFriend, sendMessageMutation]);

  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  }, [handleSendMessage]);

  // Get friends list (mutual followers)
  const friendsList = following?.filter((followedUser) => {
    // Check if this is a mutual follow by looking at recent chats
    return recentChats?.some(([chatUser]) => chatUser.toString() === followedUser.toString());
  }) || [];

  // Combine friends from following and recent chats
  const allFriends = Array.from(new Set([
    ...friendsList.map(f => f.toString()),
    ...(recentChats?.map(([user]) => user.toString()) || [])
  ])).map(principalStr => Principal.fromText(principalStr));

  if (!identity) {
    return (
      <div className="container max-w-7xl mx-auto py-8">
        <Card className="text-center p-12">
          <MessageCircle className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-2xl font-bold mb-2">Login Required</h2>
          <p className="text-muted-foreground">Please login to access your messages.</p>
        </Card>
      </div>
    );
  }

  if (profileLoading || chatsLoading || followingLoading) {
    return (
      <div className="container max-w-7xl mx-auto py-8">
        <Card className="text-center p-12">
          <Loader2 className="h-16 w-16 mx-auto mb-4 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading messages...</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="container max-w-7xl mx-auto py-8">
      <div className="mb-6 page-header-animate">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <MessageCircle className="h-8 w-8 text-primary" />
          Messages
        </h1>
        <p className="text-muted-foreground mt-1">Chat with your friends</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-[calc(100vh-200px)]">
        {/* Friends List */}
        <Card className="md:col-span-1 messages-sidebar-animate">
          <CardHeader>
            <CardTitle className="text-lg">Friends</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[calc(100vh-300px)]">
              {allFriends.length === 0 ? (
                <div className="p-6 text-center text-muted-foreground">
                  <p className="text-sm">No friends to chat with yet.</p>
                  <p className="text-xs mt-2">Follow users to start messaging!</p>
                </div>
              ) : (
                <div className="space-y-1 p-2">
                  {allFriends.map((friend) => {
                    const chatInfo = recentChats?.find(([user]) => user.toString() === friend.toString());
                    return (
                      <FriendListItem
                        key={friend.toString()}
                        friend={friend}
                        isSelected={selectedFriend?.toString() === friend.toString()}
                        onClick={() => setSelectedFriend(friend)}
                        lastMessageTime={chatInfo?.[1]}
                      />
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Chat Area */}
        <Card className="md:col-span-2 flex flex-col messages-chat-animate">
          {selectedFriend ? (
            <>
              <CardHeader className="border-b">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={selectedFriendProfile?.profilePicture || '/assets/generated/default-avatar.dim_100x100.png'} />
                    <AvatarFallback>{selectedFriendProfile?.displayName?.charAt(0).toUpperCase() || '?'}</AvatarFallback>
                  </Avatar>
                  <div>
                    <CardTitle className="text-lg">{selectedFriendProfile?.displayName || 'Loading...'}</CardTitle>
                    <p className="text-xs text-muted-foreground">@{selectedFriendProfile?.username || ''}</p>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="flex-1 overflow-hidden p-4">
                <ScrollArea className="h-full pr-4" ref={scrollAreaRef}>
                  {messagesLoading ? (
                    <div className="flex items-center justify-center h-full">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                  ) : messages && messages.length > 0 ? (
                    <div className="space-y-2">
                      {messages.map((message) => (
                        <MessageBubble
                          key={message.id.toString()}
                          message={message}
                          isOwn={message.from.toString() === identity.getPrincipal().toString()}
                          senderProfile={
                            message.from.toString() === identity.getPrincipal().toString()
                              ? userProfile
                              : selectedFriendProfile
                          }
                        />
                      ))}
                      <div ref={messagesEndRef} />
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-full text-center text-muted-foreground">
                      <div>
                        <MessageCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No messages yet</p>
                        <p className="text-xs mt-1">Start the conversation!</p>
                      </div>
                    </div>
                  )}
                </ScrollArea>
              </CardContent>

              <Separator />

              <div className="p-4">
                <div className="flex gap-2">
                  <Input
                    placeholder="Type a message..."
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    onKeyPress={handleKeyPress}
                    disabled={sendMessageMutation.isPending}
                    className="flex-1"
                  />
                  <Button
                    onClick={handleSendMessage}
                    disabled={!messageText.trim() || sendMessageMutation.isPending}
                    size="icon"
                    className="button-hover-scale"
                  >
                    {sendMessageMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-center p-8">
              <div className="empty-state-animate">
                <img
                  src="/assets/generated/chat-icon-transparent.dim_32x32.png"
                  alt="Select a chat"
                  className="h-24 w-24 mx-auto mb-4 opacity-50"
                />
                <h3 className="text-xl font-semibold mb-2">Select a friend to start chatting</h3>
                <p className="text-muted-foreground text-sm">
                  Choose a friend from the list to view your conversation
                </p>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
