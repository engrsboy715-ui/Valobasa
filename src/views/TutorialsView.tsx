import { useEffect, useState, useRef } from 'react';
import { supabase, fetchTutorials, type Tutorial } from '@/lib/supabase';
import { timeAgo } from '@/lib/format';
import { cn } from '@/lib/cn';
import { ChevronLeft, PlayCircle, Loader2, Video, X } from 'lucide-react';

export function TutorialsView({ onBack }: { onBack: () => void }) {
  const [tutorials, setTutorials] = useState<Tutorial[]>([]);
  const [loading, setLoading] = useState(true);
  const [playing, setPlaying] = useState<Tutorial | null>(null);

  useEffect(() => {
    load();
    const channel = supabase
      .channel('tutorials_user')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tutorials' },
        () => load(),
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const load = async () => {
    const data = await fetchTutorials();
    setTutorials(data);
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="sticky top-0 z-30 flex items-center gap-2 border-b border-slate-200 bg-white px-3 py-3">
        <button onClick={onBack} className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-700 active:scale-95">
          <ChevronLeft size={20} />
        </button>
        <h1 className="text-base font-bold text-slate-800">App Tutorials</h1>
      </div>

      <div className="px-4 py-5 pb-24">
        <div className="mb-5 overflow-hidden rounded-2xl bg-gradient-to-br from-violet-600 to-violet-800 p-5 text-white shadow-lg">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15">
              <Video size={24} />
            </div>
            <div>
              <p className="text-base font-bold">App Tutorials</p>
              <p className="text-xs text-violet-200">Watch videos to learn how to complete tasks easily</p>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-violet-600" />
          </div>
        ) : tutorials.length === 0 ? (
          <div className="rounded-2xl bg-white p-8 text-center ring-1 ring-slate-200">
            <Video size={40} className="mx-auto mb-3 text-slate-300" />
            <p className="text-sm text-slate-400">No tutorials available yet. Check back soon!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {tutorials.map((t) => (
              <button
                key={t.id}
                onClick={() => setPlaying(t)}
                className="flex w-full items-center gap-3 rounded-2xl bg-white p-3.5 text-left ring-1 ring-slate-200/70 transition active:scale-[0.99] hover:ring-violet-200"
              >
                <span className="relative flex h-16 w-24 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-900">
                  <video src={t.video_url} className="h-full w-full object-cover" muted preload="metadata" />
                  <span className="absolute inset-0 flex items-center justify-center bg-black/30">
                    <PlayCircle size={28} className="text-white" />
                  </span>
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-slate-800">{t.title}</p>
                  <p className="text-xs text-slate-400">{timeAgo(new Date(t.created_at).getTime())}</p>
                </div>
                <ChevronLeft size={20} className="rotate-180 text-slate-400" />
              </button>
            ))}
          </div>
        )}
      </div>

      {playing && (
        <VideoPlayer tutorial={playing} onClose={() => setPlaying(null)} />
      )}
    </div>
  );
}

function VideoPlayer({ tutorial, onClose }: { tutorial: Tutorial; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    videoRef.current?.play().catch(() => {});
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black" >
      <div className="flex items-center gap-2 bg-black/80 px-3 py-3">
        <button onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white active:scale-95">
          <X size={20} />
        </button>
        <p className="truncate text-sm font-bold text-white">{tutorial.title}</p>
      </div>
      <div className="flex flex-1 items-center justify-center p-4">
        <video
          ref={videoRef}
          src={tutorial.video_url}
          controls
          autoPlay
          className="max-h-full max-w-full rounded-xl"
        />
      </div>
    </div>
  );
}
