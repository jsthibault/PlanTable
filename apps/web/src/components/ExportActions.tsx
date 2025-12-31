import { useAppStore } from '@/store';
import { useI18n } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { generateCSV, downloadFile } from '@/lib/algorithm';
import { FileText, FileImage } from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

export function ExportActions() {
  const { result } = useAppStore();
  const { locale } = useI18n();

  if (!result || !result.success || result.tables.length === 0) {
    return null;
  }

  const handleExportCSV = () => {
    const csvContent = generateCSV(result.tables);
    downloadFile(csvContent, 'plan-de-table.csv', 'text/csv;charset=utf-8;');
  };

  const handleExportPDF = async () => {
    // Créer un élément temporaire pour l'export
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = generateHTMLForPDF(result.tables, locale);
    tempDiv.style.position = 'absolute';
    tempDiv.style.left = '-9999px';
    tempDiv.style.width = '800px';
    tempDiv.style.padding = '20px';
    tempDiv.style.backgroundColor = 'white';
    document.body.appendChild(tempDiv);

    try {
      const canvas = await html2canvas(tempDiv, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: canvas.width > canvas.height ? 'landscape' : 'portrait',
        unit: 'px',
        format: [canvas.width, canvas.height],
      });

      pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
      pdf.save('plan-de-table.pdf');
    } finally {
      document.body.removeChild(tempDiv);
    }
  };

  return (
    <div className="flex flex-wrap gap-3">
      <Button variant="outline" onClick={handleExportCSV}>
        <FileText className="h-4 w-4 mr-2" />
        {locale === 'fr' ? 'Exporter CSV' : 'Export CSV'}
      </Button>
      <Button variant="outline" onClick={handleExportPDF}>
        <FileImage className="h-4 w-4 mr-2" />
        {locale === 'fr' ? 'Exporter PDF' : 'Export PDF'}
      </Button>
    </div>
  );
}

// Générer le HTML pour l'export PDF
function generateHTMLForPDF(
  tables: { number: number; name: string; guests: { firstName: string; lastName?: string | undefined; role: string }[] }[],
  locale: 'fr' | 'en'
): string {
  const roleLabels: Record<string, string> = locale === 'fr'
    ? {
        married: '💍 Marié(e)',
        witness: '⭐ Témoin',
        regular: 'Invité',
      }
    : {
        married: '💍 Married',
        witness: '⭐ Witness',
        regular: 'Guest',
      };

  const title = locale === 'fr' ? '🎊 Plan de Table' : '🎊 Seating Chart';
  const guestsLabel = locale === 'fr' ? 'invités' : 'guests';

  return `
    <div style="font-family: Arial, sans-serif; padding: 40px;">
      <h1 style="text-align: center; color: #7c3aed; margin-bottom: 30px;">
        ${title}
      </h1>
      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px;">
        ${tables
          .map(
            (table) => `
          <div style="
            border: ${table.number === 1 ? '3px solid #7c3aed' : '1px solid #e5e7eb'};
            border-radius: 12px;
            padding: 16px;
            background: ${table.number === 1 ? '#f5f3ff' : '#ffffff'};
          ">
            <h2 style="
              margin: 0 0 12px 0;
              font-size: 16px;
              color: ${table.number === 1 ? '#7c3aed' : '#374151'};
            ">
              ${table.number === 1 ? '👑 ' : ''}${table.name}
            </h2>
            <ul style="list-style: none; padding: 0; margin: 0;">
              ${table.guests
                .map(
                  (guest) => `
                <li style="
                  padding: 6px 0;
                  border-bottom: 1px solid #f3f4f6;
                  font-size: 14px;
                ">
                  ${guest.firstName} ${guest.lastName ?? ''}
                  ${guest.role !== 'regular' ? `<span style="color: #6b7280; font-size: 12px;">(${roleLabels[guest.role]})</span>` : ''}
                </li>
              `
                )
                .join('')}
            </ul>
            <div style="
              text-align: right;
              font-size: 12px;
              color: #9ca3af;
              margin-top: 8px;
            ">
              ${table.guests.length} ${guestsLabel}
            </div>
          </div>
        `
          )
          .join('')}
      </div>
      <div style="
        text-align: center;
        margin-top: 40px;
        font-size: 12px;
        color: #9ca3af;
      ">
        ${locale === 'fr' ? 'Généré avec' : 'Generated with'} PlanTable - ${new Date().toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-US')}
      </div>
    </div>
  `;
}
