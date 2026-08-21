import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen p-8">
      <h1 className="text-2xl font-semibold mb-4">Viral Lab</h1>
      <ul className="list-disc pl-6 space-y-1">
        <li>
          <Link href="/review" className="text-blue-600 hover:underline">
            /review
          </Link>
        </li>
      </ul>
    </main>
  );
}
