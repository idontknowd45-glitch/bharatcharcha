# BharatCharcha

A web-based microblogging platform built entirely on the Internet Computer with multiple Motoko canisters for scalable social media functionality.

## Core Features

### User Management
- User registration and authentication via Internet Identity
- User profiles with username, display name, bio, and profile picture
- Follow/unfollow functionality
- Block list management
- Mock OTP login interface (non-functional demonstration)
- Public profile viewing for all non-suspended users

### Posts and Content
- Create text posts with up to 280 characters
- Support for hashtags in posts
- Reply to posts with threaded conversations
- Repost functionality (share existing posts)
- Like posts
- Support for up to 4 images per post
- Video placeholder support (URLs only)
- Automatic timeline distribution when creating posts
- Optimistic post creation with instant UI updates and retry on failure

### Timeline and Discovery
- Home timeline showing posts from followed users
- Explore page with trending hashtags and recent posts
- Individual post view pages
- User profile pages showing their posts
- Hashtag-based post discovery
- Progressive timeline fetching with infinite scroll
- Live timeline updates via short polling (every 3 seconds)
- Virtualized scrolling for large feeds maintaining 60 FPS performance

### Real-time Messaging
- Direct messaging between users who follow each other
- Send text messages to users in friend list (followers)
- View full conversation history in chronological order
- Recent chats list showing most recent conversations
- Real-time message updates via polling
- Optimistic message sending with instant UI feedback

### Notifications
- Notifications for new followers
- Notifications for likes on user's posts
- Notifications for replies to user's posts
- Notifications for mentions in posts
- Notifications for reposts of user's content

### Admin and Moderation
- Admin dashboard for content moderation
- Content reporting system
- Post takedown capabilities
- User suspension controls
- Audit logs for admin actions
- Data deletion requests in user settings

## Backend Architecture

### Multi-Canister Design
- **User Canister**: Manages user profiles, authentication, followers/following relationships, and block lists
- **Post Canister**: Handles post creation, replies, reposts, hashtags, and media references with proper data synchronization
- **Timeline Canister**: Stores and serves user timelines, trending content using fan-out on write approach with immediate updates
- **Notification Canister**: Manages all user notifications
- **Message Canister**: Handles direct messaging between users with bidirectional message storage
- **Admin Canister**: Provides moderation tools and audit capabilities

### Data Storage
- Persistent storage using stable TrieMap and HashMap structures prepared for future stable var migration
- User data: profiles, follower relationships, preferences
- Post data: content, metadata, engagement metrics
- Timeline data: pre-computed user feeds with automatic distribution
- Notification data: user-specific notification queues
- Message data: conversation threads between users with chronological ordering
- Admin data: moderation logs and takedown records

### Core Operations
- User registration and profile management
- Public profile viewing with suspension checks
- Post creation with automatic timeline distribution to author and followers
- Social interactions (follow, like, reply, repost)
- Timeline generation and serving with real-time updates
- Direct message sending and retrieval between followers
- Message thread management with bidirectional synchronization
- Recent chat list generation
- Notification creation and delivery
- Content moderation and admin actions
- Flexible authorization system for future privacy adjustments
- Proper post data synchronization ensuring content, hashtags, and mediaIds are correctly stored and retrieved

### Authorization and Privacy
- Modular privacy checks for followers/following and block lists
- Message sending restricted to users in friend list (mutual followers)
- Configurable authorization logic with guard clauses
- Future-ready permission system for easy privacy setting adjustments
- Public profile access for non-suspended users

## Frontend Features

### Pages and Navigation
- Home timeline page
- Explore/trending page
- Individual post detail pages
- User profile pages
- Messages page with chat interface
- Notifications page
- Settings page with profile editing
- Admin dashboard (for authorized users)

### User Interface
- Post composer with character count and optimistic post creation
- Post cards with engagement buttons and instant interaction feedback
- Reply threading interface
- Trending hashtags sidebar
- User cards and follow buttons
- Chat interface with friend list and message threads
- Real-time message display with typing animations
- Dark/light theme toggle
- Language preference setting (English)
- BharatCharcha branding throughout the interface

### Performance and Animation Optimization
- Framer Motion animations throughout the app including post creation, timeline updates, likes, retweets, modals, menus, page transitions, and messaging
- Instant like animation with spring transitions and heart scale effects
- Smooth typing and message sending animations in chat interface
- React Virtualized or React Window for smooth scrolling in large feeds and message history
- Lazy image loading with blur-to-clear transitions and skeleton placeholders
- Progressive timeline fetching with infinite scroll loading
- Short polling for live timeline updates every 3 seconds
- Short polling for message updates every 2 seconds
- Non-blocking UI updates with immediate React state changes and background backend operations
- Optimized React rendering with memo and useCallback hooks
- Smooth scrolling performance for large timelines, image posts, and chat history
- React useTransition for smooth UI updates during interactions
- Accessibility support with reduced-motion preferences

### Optimistic UI Interactions
- Immediate post insertion in timeline before backend confirmation
- Instant like/unlike feedback with animation while backend processes asynchronously
- Instant message display in chat before backend confirmation
- Retry mechanisms for failed operations
- Temporary post and message states with loading indicators
- Background promise handling for all user interactions

### Authentication Flow
- Internet Identity integration
- Mock OTP login interface (visual only)
- Secure session management

## Content and Media

### Text Content
- Support for hashtags with # symbol
- User mentions with @ symbol
- Character limit enforcement
- Basic text formatting preservation
- Direct message text content

### Media Support
- Image upload and display (up to 4 per post)
- Image storage in asset canister
- Video placeholder URLs (no actual video processing)
- Lazy loading with progressive enhancement

## Performance and Scalability

### Timeline Strategy
- Fan-out on write approach for home timelines
- Automatic post distribution to author and follower timelines with immediate visibility
- Pre-computed user feeds stored in Timeline Canister
- Efficient query patterns for timeline serving
- Progressive loading with infinite scroll
- Live updates via polling mechanism

### Messaging Strategy
- Bidirectional message storage for efficient conversation retrieval
- Chronological message ordering within conversations
- Recent chat list based on latest message timestamps
- Lazy rendering for long message histories
- Real-time updates via short polling

### Trending Algorithm
- Hashtag frequency tracking
- Time-based decay for trending calculation
- Client-side sorting of trending topics

### Code Quality and Maintenance
- Clean Motoko code without unnecessary transient keywords
- Future-ready data structures for stable var migration
- Modular authorization system for easy privacy adjustments
- Proper error handling and data validation for post creation and messaging

## Compliance Features

### Content Moderation
- User reporting system for inappropriate content
- Admin review queue for reported content
- Content takedown and removal capabilities

### Data Privacy
- User data deletion requests
- Audit trail for data operations
- Privacy settings management

### Administrative Controls
- User suspension and account management
- Content moderation dashboard
- System audit logs and reporting
