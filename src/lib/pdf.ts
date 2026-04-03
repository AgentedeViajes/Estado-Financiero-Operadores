import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Reservation } from '../types';
import { format } from 'date-fns';

export const generatePDF = (title: string, reservations: Reservation[]) => {
  const doc = new jsPDF('landscape');
  
  doc.setFontSize(18);
  doc.text(title, 14, 22);
  
  doc.setFontSize(11);
  doc.text(`Fecha de generación: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 14, 30);

  const tableColumn = [
    "Operador",
    "PH Nemo",
    "Localizador",
    "SITI",
    "Pasajero",
    "Límite Pago",
    "Agente",
    "Valor Neto",
    "Estado"
  ];

  const tableRows = reservations.map(res => [
    res.operator,
    res.phNemo,
    res.localizador,
    res.siti,
    res.apellido,
    format(new Date(res.limitePago), 'dd/MM/yyyy'),
    res.agente,
    `$${res.valorNeto.toFixed(2)}`,
    res.isPaid ? 'Abonada' : 'Pendiente'
  ]);

  autoTable(doc, {
    head: [tableColumn],
    body: tableRows,
    startY: 35,
    styles: { fontSize: 9 },
    headStyles: { fillColor: [41, 128, 185] },
    didParseCell: function(data) {
      if (data.section === 'body' && data.column.index === 8) {
        if (data.cell.raw === 'Abonada') {
          data.cell.styles.textColor = [39, 174, 96]; // Green
          data.cell.styles.fontStyle = 'bold';
        } else {
          data.cell.styles.textColor = [192, 57, 43]; // Red
        }
      }
    }
  });

  doc.save(`${title.replace(/\s+/g, '_').toLowerCase()}_${format(new Date(), 'yyyyMMdd')}.pdf`);
};
