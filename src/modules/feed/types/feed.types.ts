// feed.types.ts
export interface MappedAuthor {
  userId: string;
  name: string;
  avatarUrl: string | null;
  role: string;
}

export interface MappedComment {
  feedCommentId: string;
  content: string;
  author: MappedAuthor;
  parentId: string | null;
  replies: MappedComment[];
  createdAt: Date;
}

export interface MappedAttachment {
  feedAttachmentId: string;
  type: 'IMAGE' | 'FILE';
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  url: string;
}

export interface MappedPost {
  feedPostId: string;
  type: 'PUBLICATION' | 'RECOGNITION' | 'ANNOUNCEMENT';
  content: string;
  // images: string[];
  pinned: boolean;
  author: MappedAuthor;
  recognizedUser: MappedAuthor | null;
  reactionsCount: number;
  reactionsSummary: Record<string, number>;
  recentReactors: MappedAuthor[];
  myReaction: string | null;
  comments: MappedComment[];
  commentsCount: number;
  createdAt: Date;
  updatedAt: Date;
  attachments: MappedAttachment[];
}

export interface ReactionPayload {
  reactionsCount: number;
  reactionsSummary: Record<string, number>;
  recentReactors: MappedAuthor[];
  /** userId → tipo. Cada cliente resuelve su myReaction. */
  reactionsByUser: Record<string, string>;
}
