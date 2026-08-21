"use client";

import { useCallback, useState } from "react";
import { parseWorkbookFromFile, type ParseResult } from "@/lib/excel/parse";
import { HeaderDetectionError } from "@/lib/excel/headers";

const PREVIEW_LIMIT = 3;

const colLabel = (idx: number): string => {
  // 0 → A, 25 → Z, 26 → AA
  let n = idx;
  let s = "";
  do {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return s;
};

export default function ReviewUploader() {
  const [fileName, setFileName] = useState<string | null>(null);
  const [result, setResult] = useState<ParseResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleFile = useCallback(async (file: File) => {
    setLoading(true);
    setError(null);
    setResult(null);
    setFileName(file.name);
    try {
      const parsed = await parseWorkbookFromFile(file);
      setResult(parsed);
    } catch (e) {
      if (e instanceof HeaderDetectionError) {
        setError(e.message);
      } else if (e instanceof Error) {
        setError(`파일을 읽지 못했습니다: ${e.message}`);
      } else {
        setError("알 수 없는 오류가 발생했습니다.");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void handleFile(file);
  };

  const reset = () => {
    setFileName(null);
    setResult(null);
    setError(null);
  };

  return (
    <div className="space-y-6">
      <section className="p-5 rounded-lg border border-slate-200 bg-white">
        <label className="block">
          <span className="text-sm font-medium text-slate-700">
            Excel 파일 선택 (.xlsx / .xls)
          </span>
          <input
            type="file"
            accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
            onChange={onInputChange}
            className="block mt-2 text-sm"
          />
        </label>
        {fileName && (
          <div className="mt-3 text-xs text-slate-500 flex items-center gap-3">
            <span>선택된 파일: <span className="font-mono">{fileName}</span></span>
            <button
              type="button"
              onClick={reset}
              className="text-blue-600 hover:underline"
            >
              초기화
            </button>
          </div>
        )}
      </section>

      {loading && (
        <div className="text-sm text-slate-500">파일 파싱 중…</div>
      )}

      {error && (
        <div className="p-4 rounded-lg border border-red-200 bg-red-50 text-red-700 text-sm whitespace-pre-wrap">
          {error}
        </div>
      )}

      {result && <ParseSummary result={result} />}
    </div>
  );
}

function ParseSummary({ result }: { result: ParseResult }) {
  const { header, rows, skippedEmptyDraftCount, refOriginalPresent, imagePresent, sheetName } = result;
  const previewRows = rows.slice(0, PREVIEW_LIMIT);

  return (
    <div className="space-y-6">
      <section className="p-5 rounded-lg border border-slate-200 bg-white">
        <h2 className="text-lg font-semibold mb-3">Header 자동 감지 결과</h2>
        <dl className="grid grid-cols-1 md:grid-cols-2 gap-y-2 gap-x-6 text-sm">
          <Row k="시트" v={sheetName} />
          <Row k="Header 행 번호 (1-index)" v={String(header.headerRowIndex + 1)} />
          <Row k="순서 열" v={`${colLabel(header.order)} (col ${header.order + 1})`} />
          <Row
            k="레퍼런스 URL 열"
            v={`${colLabel(header.refUrl)} — matched: "${header.matchedAliases.refUrl}"`}
          />
          <Row
            k="작성안(리뷰내용) 열"
            v={`${colLabel(header.draft)} — matched: "${header.matchedAliases.draft}"`}
          />
          <Row
            k="이미지 파일명 열"
            v={imagePresent ? `${colLabel(header.image!)}` : "— (선택, 없음)"}
          />
          <Row
            k="레퍼런스 원문 열"
            v={
              refOriginalPresent
                ? `${colLabel(header.refOriginal!)} — Critical Gate 활성`
                : "— (없음: Draft 단독 분석 예정)"
            }
          />
        </dl>
      </section>

      <section className="p-5 rounded-lg border border-slate-200 bg-white">
        <h2 className="text-lg font-semibold mb-1">파싱 요약</h2>
        <p className="text-sm text-slate-600 mb-3">
          유효 데이터 <b>{rows.length}</b> 행 · 빈 리뷰내용으로 스킵된 행{" "}
          <b>{skippedEmptyDraftCount}</b> 개
        </p>
        <h3 className="text-sm font-semibold mt-4 mb-2">
          미리보기 (앞 {Math.min(PREVIEW_LIMIT, rows.length)} 행)
        </h3>
        {previewRows.length === 0 ? (
          <div className="text-sm text-slate-500">유효 데이터 행이 없습니다.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs border border-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <Th>#</Th>
                  <Th>Sheet Row</Th>
                  <Th>Ref URL</Th>
                  <Th>Draft (리뷰내용)</Th>
                  <Th>이미지</Th>
                  <Th>Ref Original</Th>
                </tr>
              </thead>
              <tbody>
                {previewRows.map((r) => (
                  <tr key={r.index} className="border-t border-slate-100 align-top">
                    <Td>{r.index + 1}</Td>
                    <Td>{r.sheetRowNumber}</Td>
                    <Td className="max-w-[200px] truncate">{r.refUrl ?? "—"}</Td>
                    <Td className="max-w-[360px]">
                      <div className="whitespace-pre-wrap line-clamp-4">{r.draft}</div>
                    </Td>
                    <Td>{r.imageFilename ?? "—"}</Td>
                    <Td className="max-w-[240px]">
                      {r.refOriginal ? (
                        <div className="whitespace-pre-wrap line-clamp-4">{r.refOriginal}</div>
                      ) : (
                        "—"
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className="text-xs text-slate-500">
        Phase 1 범위: 여기까지가 로컬 파일 파싱 결과입니다. 실제 분석(Claude 호출)은 Phase 2에서 붙습니다.
      </p>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex gap-2">
      <dt className="text-slate-500 min-w-[10rem]">{k}</dt>
      <dd className="text-slate-900 font-mono text-xs break-all">{v}</dd>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="text-left font-semibold px-2 py-1 border-b border-slate-200 whitespace-nowrap">
      {children}
    </th>
  );
}

function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-2 py-1 ${className ?? ""}`}>{children}</td>;
}
