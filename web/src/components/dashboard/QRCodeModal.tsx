import React, { useState, useEffect } from 'react';
import {
  QrCode,
  X,
  Printer,
  ExternalLink,
  Copy,
  CheckCheck,
  Building2,
  Sparkles,
  ShieldCheck,
  Zap,
  Info
} from 'lucide-react';
import Link from 'next/link';

export interface Room {
  id: string | number;
  name: string;
  nominal_power: number;
  category?: string;
}

interface QRCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  room: Room | null;
}

export default function QRCodeModal({ isOpen, onClose, room }: QRCodeModalProps) {
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [origin, setOrigin] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setOrigin(window.location.origin);
    }
  }, []);

  if (!isOpen || !room) return null;

  const bookingUrl = `${origin}/book/${room.id}`;
  const qrCodeApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(bookingUrl)}&color=090d16&bgcolor=ffffff&margin=2&qzone=1`;

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(bookingUrl);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="ms">
        <head>
          <meta charset="utf-8">
          <title>Kad Pintu Makmal - ${room.name} (POLISAS)</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800;900&family=JetBrains+Mono:wght@500;700&display=swap');
            
            * {
              box-sizing: border-box;
              margin: 0;
              padding: 0;
            }
            body {
              font-family: 'Plus Jakarta Sans', -apple-system, sans-serif;
              background-color: #f1f5f9;
              padding: 40px 20px;
              display: flex;
              justify-content: center;
              align-items: center;
              min-height: 100vh;
              color: #0f172a;
            }
            .card {
              width: 500px;
              padding: 40px;
              background: #ffffff;
              border: 3px solid #0f172a;
              border-radius: 28px;
              box-shadow: 0 25px 50px -12px rgba(15, 23, 42, 0.15);
              text-align: center;
              position: relative;
            }
            .poly-badge {
              display: inline-block;
              font-size: 11px;
              font-weight: 900;
              letter-spacing: 2px;
              color: #0369a1;
              background: #e0f2fe;
              border: 1px solid #bae6fd;
              padding: 4px 12px;
              border-radius: 9999px;
              text-transform: uppercase;
              margin-bottom: 12px;
            }
            .dept-title {
              font-size: 12px;
              font-weight: 700;
              color: #64748b;
              letter-spacing: 1px;
              text-transform: uppercase;
              margin-bottom: 8px;
            }
            h1 {
              font-size: 26px;
              font-weight: 900;
              color: #0f172a;
              margin: 4px 0 8px 0;
              line-height: 1.2;
            }
            .category {
              font-size: 12px;
              font-weight: 700;
              color: #059669;
              background: #ecfdf5;
              border: 1px solid #a7f3d0;
              padding: 4px 12px;
              border-radius: 8px;
              display: inline-block;
              margin-bottom: 20px;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }
            .qr-wrapper {
              display: inline-block;
              padding: 16px;
              background: #ffffff;
              border: 3px solid #0f172a;
              border-radius: 24px;
              box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1);
              margin-bottom: 20px;
            }
            .qr-img {
              width: 250px;
              height: 250px;
              display: block;
            }
            .instructions {
              text-align: left;
              background: #f8fafc;
              border: 1.5px solid #e2e8f0;
              padding: 18px 20px;
              border-radius: 18px;
              margin-bottom: 20px;
            }
            .instructions-title {
              font-size: 12px;
              font-weight: 900;
              color: #0f172a;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              margin-bottom: 8px;
              display: flex;
              align-items: center;
              gap: 6px;
            }
            .instructions ol {
              padding-left: 18px;
              font-size: 12px;
              color: #334155;
              line-height: 1.6;
            }
            .instructions ol li {
              margin-bottom: 4px;
            }
            .instructions ol li strong {
              color: #0f172a;
            }
            .footer {
              border-top: 2px dashed #cbd5e1;
              padding-top: 16px;
              font-family: 'JetBrains Mono', monospace;
              font-size: 10px;
              color: #64748b;
              display: flex;
              justify-content: space-between;
              align-items: center;
            }
            @media print {
              body {
                background: none;
                padding: 0;
              }
              .card {
                box-shadow: none;
                border: 3px solid #000;
                width: 100%;
                max-width: 520px;
                margin: 0 auto;
                page-break-inside: avoid;
              }
            }
          </style>
        </head>
        <body>
          <div class="card">
            <div>
              <div class="poly-badge">POLITEKNIK SULTAN HAJI AHMAD SHAH</div>
              <div class="dept-title">Jabatan Kejuruteraan Elektrik • Sistem SCEAS</div>
              <h1>${room.name}</h1>
              <div class="category">${room.category || 'MAKMAL JABATAN'} • BEBAN ${room.nominal_power} WATT</div>
            </div>

            <div class="qr-wrapper">
              <img class="qr-img" src="${qrCodeApiUrl}" alt="QR Code Tempahan Sesi Makmal" />
            </div>

            <div class="instructions">
              <div class="instructions-title">📌 PANDUAN PENSYARAH &amp; PELAJAR:</div>
              <ol>
                <li>Imbas kod QR menggunakan <strong>kamera telefon pintar</strong> untuk mendaftar masuk sesi kuliah/makmal.</li>
                <li>Sistem SCEAS akan <strong>menghidupkan suis lampu</strong> mengikut tempoh masa yang dipilih.</li>
                <li>Pensyarah akan menerima <strong>notifikasi amaran pintar</strong> sekiranya lampu tertinggal selepas sesi berakhir.</li>
              </ol>
            </div>

            <div class="footer">
              <span>SCEAS v2.0 SMART ENERGY</span>
              <span>UUID: ${room.id}</span>
            </div>
          </div>
          <script>
            window.onload = function() {
              window.print();
            }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl animate-fade-in">
      <div className="relative w-full max-w-lg overflow-hidden rounded-3xl bg-slate-900 border border-slate-800/90 shadow-2xl text-slate-100 p-6 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-4 mb-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-sapphire-500/10 border border-sapphire-500/25 text-sapphire-400">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-400 font-mono">
                POLISAS • MAKMAL PINTAR
              </span>
              <h3 className="text-base sm:text-lg font-bold text-slate-100">
                Kad QR Pintu Makmal
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-100 rounded-2xl hover:bg-slate-800/80 transition"
            title="Tutup"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Card Body with High Contrast QR Box */}
        <div className="bg-slate-950/80 border border-slate-800/80 rounded-2xl p-5 flex flex-col items-center text-center mb-5 relative overflow-hidden">
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-sapphire-400 mb-1">
            <Building2 className="w-4 h-4" />
            <span>{room.category || 'MAKMAL'} • POLISAS</span>
          </div>
          <h4 className="text-lg sm:text-xl font-extrabold text-slate-100 mb-1">{room.name}</h4>
          <span className="text-xs text-slate-400 font-mono mb-4">
            Beban Nominal: <strong className="text-emerald-400">{room.nominal_power} Watt</strong>
          </span>

          {/* High Resolution Clean White Frame */}
          <div className="p-3 bg-white rounded-2xl shadow-2xl border-4 border-slate-800">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={qrCodeApiUrl}
              alt={`QR Code untuk ${room.name}`}
              className="w-48 h-48 block rounded-lg"
            />
          </div>

          <div className="mt-4 p-3 bg-slate-900/90 rounded-xl border border-slate-800 text-xs text-slate-300 max-w-sm">
            <p className="leading-relaxed">
              Imbas menggunakan kamera telefon untuk <strong>Daftar Masuk Sesi (Check-In)</strong>, buka lampu makmal, dan terima amaran pintar.
            </p>
          </div>
        </div>

        {/* URL Box */}
        <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs mb-5 font-mono text-slate-400">
          <span className="truncate flex-1 select-all text-slate-300">{bookingUrl}</span>
          <button
            onClick={handleCopyUrl}
            className="px-2.5 py-1.5 rounded-lg bg-slate-850 hover:bg-slate-800 text-slate-300 hover:text-emerald-400 transition shrink-0 flex items-center gap-1.5 font-sans font-bold"
            title="Salin Pautan Tempahan"
          >
            {copiedUrl ? (
              <>
                <CheckCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-[11px] text-emerald-400">Disalin!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span className="text-[11px]">Salin URL</span>
              </>
            )}
          </button>
        </div>

        {/* Actions */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Link
            href={`/book/${room.id}`}
            target="_blank"
            className="px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-850 hover:bg-slate-800 text-slate-200 hover:text-white text-xs font-bold transition flex items-center justify-center gap-2"
          >
            <ExternalLink className="w-4 h-4 text-sapphire-400" />
            <span>Buka Halaman Tempahan</span>
          </Link>

          <button
            onClick={handlePrint}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-sapphire-600 to-blue-600 hover:from-sapphire-500 hover:to-blue-500 text-white text-xs font-bold transition shadow-glow-sapphire flex items-center justify-center gap-2"
          >
            <Printer className="w-4 h-4" />
            <span>Cetak Kad Pintu (PDF)</span>
          </button>
        </div>
      </div>
    </div>
  );
}
