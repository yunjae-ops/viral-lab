import ReviewUploader from "./components/ReviewUploader";

export const metadata = { title: "Review — Viral Lab" };

export default function ReviewPage() {
  return (
    <main className="min-h-screen p-6 md:p-10 max-w-6xl mx-auto">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">/review</h1>
        <p className="text-sm text-slate-600 mt-1">
          Threads 콘텐츠 초안 Excel을 업로드하면 Header 자동 감지 후 전체 작성안을 배치 분석하고,
          사이트 안에서 소재별로 검토할 수 있습니다. Excel 파일 자체는 브라우저에서만 파싱되며 서버로 전송되지 않습니다.
        </p>
      </header>
      <ReviewUploader />
    </main>
  );
}
