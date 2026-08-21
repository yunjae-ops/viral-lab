import ReviewUploader from "./components/ReviewUploader";

export const metadata = { title: "Review — Viral Lab" };

export default function ReviewPage() {
  return (
    <main className="min-h-screen p-6 md:p-10 max-w-6xl mx-auto">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">/review</h1>
        <p className="text-sm text-slate-600 mt-1">
          Threads 콘텐츠 초안 Excel을 업로드하면 Header 자동 감지 · 미리보기를 표시합니다.
          Phase 1: 브라우저 파싱만 수행하며 파일은 서버로 전송되지 않습니다.
        </p>
      </header>
      <ReviewUploader />
    </main>
  );
}
