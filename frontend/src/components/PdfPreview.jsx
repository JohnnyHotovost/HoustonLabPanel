import React, { useEffect, useRef, useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { ChevronLeft, ChevronRight, FileWarning } from 'lucide-react';
import { useI18n } from '../lib/i18n';
import { IconBtn } from './common';

// Bundled worker: no CDN, no external document service, no embedded PDF JavaScript.
pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();
const options = { isEvalSupported: false, cMapUrl: '/pdfjs/cmaps/', cMapPacked: true, standardFontDataUrl: '/pdfjs/standard_fonts/' };

export const PdfPreview = ({ url }) => {
  const { t } = useI18n();
  const ref = useRef(null);
  const [width, setWidth] = useState(600);
  const [pages, setPages] = useState(0);
  const [page, setPage] = useState(1);
  useEffect(() => {
    const observer = new ResizeObserver(entries => setWidth(Math.max(200, entries[0].contentRect.width - 24)));
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  const failure = <div className="pdf-message" data-testid="pdf-preview-error"><FileWarning size={25}/><span>{t('documents.noPreview')}</span></div>;
  return <div className="pdf-preview" data-testid="pdf-preview" ref={ref}>
    <div className="pdf-scroll">
      <Document file={url} options={options} onLoadSuccess={({ numPages }) => { setPages(numPages); setPage(1); }} loading={<div className="pdf-message" data-testid="pdf-loading">{t('common.loading')}</div>} error={failure} noData={failure}>
        <Page pageNumber={page} width={width} renderTextLayer={false} renderAnnotationLayer={false} loading="" error={failure}/>
      </Document>
    </div>
    {pages>0 && <div className="pdf-controls"><IconBtn icon={ChevronLeft} label={t('common.previous')} data-testid="pdf-previous-page" disabled={page<=1} onClick={()=>setPage(page-1)}/><span data-testid="pdf-page-count">{t('documents.pageOf',{page,total:pages})}</span><IconBtn icon={ChevronRight} label={t('common.next')} data-testid="pdf-next-page" disabled={page>=pages} onClick={()=>setPage(page+1)}/></div>}
  </div>;
};