"use client";

import { useState, useEffect } from "react";
import { LunchEvent, LunchComment, LunchPhoto, User } from "@prisma/client";

type CommentWithMember = LunchComment & { user: User };

type Props = {
  event: LunchEvent;
};

export default function RecapTab({ event }: Props) {
  const [comments, setComments] = useState<CommentWithMember[]>([]);
  const [photos, setPhotos] = useState<LunchPhoto[]>([]);
  
  const [newComment, setNewComment] = useState("");
  const [newPhotoUrl, setNewPhotoUrl] = useState("");
  const [newPhotoCaption, setNewPhotoCaption] = useState("");
  
  const [loading, setLoading] = useState(true);
  const [postingComment, setPostingComment] = useState(false);
  const [postingPhoto, setPostingPhoto] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchData();
  }, [event.id]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [commentsRes, photosRes] = await Promise.all([
        fetch(`/api/lunch/${event.id}/comment`),
        fetch(`/api/lunch/${event.id}/photo`)
      ]);
      
      if (commentsRes.ok) setComments(await commentsRes.json());
      if (photosRes.ok) setPhotos(await photosRes.json());
    } catch (err) {
      console.error(err);
      setError("データの取得に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    try {
      setPostingComment(true);
      const res = await fetch(`/api/lunch/${event.id}/comment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: newComment })
      });

      if (!res.ok) throw new Error("コメントの投稿に失敗しました");

      const created = await res.json();
      setComments([created, ...comments]);
      setNewComment("");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setPostingComment(false);
    }
  };

  const handlePostPhoto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPhotoUrl.trim()) return;

    try {
      setPostingPhoto(true);
      const res = await fetch(`/api/lunch/${event.id}/photo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: newPhotoUrl, caption: newPhotoCaption })
      });

      if (!res.ok) throw new Error("写真の投稿に失敗しました");

      const created = await res.json();
      setPhotos([created, ...photos]);
      setNewPhotoUrl("");
      setNewPhotoCaption("");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setPostingPhoto(false);
    }
  };

  if (loading) {
    return <div className="p-4 text-center text-gray-500">読み込み中...</div>;
  }

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {error && <div className="p-3 bg-red-50 text-red-600 rounded-md text-sm">{error}</div>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* コメントセクション */}
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-gray-800 border-b pb-2">コメント</h3>
          
          <form onSubmit={handlePostComment} className="space-y-2">
            <textarea
              className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent text-sm"
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="ランチ会の感想などを入力"
              rows={3}
              required
            />
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={postingComment || !newComment.trim()}
                className="px-4 py-1.5 bg-[var(--color-primary)] text-white text-sm rounded font-medium hover:bg-opacity-90 transition-colors disabled:opacity-50"
              >
                {postingComment ? "送信中..." : "投稿"}
              </button>
            </div>
          </form>

          <div className="space-y-3 mt-4 max-h-[400px] overflow-y-auto pr-2">
            {comments.length === 0 ? (
              <p className="text-sm text-gray-500">まだコメントはありません。</p>
            ) : (
              comments.map(c => (
                <div key={c.id} className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-medium text-gray-700">{c.user.name}</span>
                    <span className="text-xs text-gray-400">
                      {new Date(c.createdAt).toLocaleString("ja-JP")}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 whitespace-pre-wrap">{c.content}</p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* 写真セクション */}
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-gray-800 border-b pb-2">写真</h3>
          
          <form onSubmit={handlePostPhoto} className="space-y-2 bg-gray-50 p-3 rounded-lg border border-gray-200">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">画像URL</label>
              <input
                type="url"
                required
                className="w-full p-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent"
                value={newPhotoUrl}
                onChange={(e) => setNewPhotoUrl(e.target.value)}
                placeholder="https://example.com/photo.jpg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">キャプション（任意）</label>
              <input
                type="text"
                className="w-full p-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent"
                value={newPhotoCaption}
                onChange={(e) => setNewPhotoCaption(e.target.value)}
                placeholder="美味しいランチでした"
              />
            </div>
            <div className="flex justify-end pt-1">
              <button
                type="submit"
                disabled={postingPhoto || !newPhotoUrl.trim()}
                className="px-4 py-1.5 bg-[var(--color-primary)] text-white text-sm rounded font-medium hover:bg-opacity-90 transition-colors disabled:opacity-50"
              >
                {postingPhoto ? "追加中..." : "写真を追加"}
              </button>
            </div>
          </form>

          <div className="grid grid-cols-2 gap-3 mt-4">
            {photos.length === 0 ? (
              <p className="text-sm text-gray-500 col-span-2">まだ写真はありません。</p>
            ) : (
              photos.map(p => (
                <div key={p.id} className="rounded-lg overflow-hidden border border-gray-200 bg-white">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.url} alt={p.caption || "ランチ写真"} className="w-full h-32 object-cover" />
                  {p.caption && (
                    <div className="p-2 text-xs text-gray-600 truncate">{p.caption}</div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
