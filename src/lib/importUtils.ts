import * as XLSX from 'xlsx';
import * as pdfjsLib from 'pdfjs-dist';

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

const excelSerialToISO = (serial: number) => {
  // Excel's epoch is Dec 30, 1899. 
  // We use Math.floor to get the integer part (the day).
  // We add a tiny epsilon (0.00001) to handle potential floating point precision issues.
  const date = new Date(Math.round((serial - 25569) * 86400 * 1000));
  // To avoid timezone shifts, we use the UTC representation
  return date.toISOString().split('T')[0];
};

const formatDateToLocalISO = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatDateToUTCISO = (date: Date) => {
  return date.toISOString().split('T')[0];
};

export async function parseExcelFile(file: File, operator: string): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        // We don't use cellDates: true here to handle serials manually and more predictably
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const json = XLSX.utils.sheet_to_json(worksheet);
        
        const parsedReservations = json.map((row: any) => {
          const getVal = (keyMatch: string) => {
            const key = Object.keys(row).find(k => {
              const cleanK = k.toLowerCase().trim();
              const cleanMatch = keyMatch.toLowerCase().trim();
              return cleanK.includes(cleanMatch);
            });
            return key ? row[key] : '';
          };

          // Parse date - try most specific names first
          let rawDate = getVal('limite de pago') || 
                        getVal('límite de pago') || 
                        getVal('vencimiento') || 
                        getVal('f. limite') || 
                        getVal('f. límite') || 
                        getVal('fecha pago') || 
                        getVal('pago limite') ||
                        getVal('vence') ||
                        getVal('limite') ||
                        getVal('venc') ||
                        getVal('fecha');
          
          let limitePago = '';

          if (typeof rawDate === 'number') {
            // Excel date serial - conversion to UTC ISO string
            limitePago = excelSerialToISO(rawDate);
          } else if (rawDate instanceof Date && !isNaN(rawDate.getTime())) {
            // If it's already a date object, use UTC to avoid one-day-off shift
            limitePago = formatDateToUTCISO(rawDate);
          } else if (typeof rawDate === 'string' && rawDate.trim()) {
            // Clean the string from time or extra spaces
            const cleanDate = rawDate.trim().split(/\s+/)[0]; 
            const parts = cleanDate.split(/[-/.]/);
            
            if (parts.length === 3) {
              let day, month, year;
              if (parts[0].length === 4) {
                // YYYY-MM-DD
                year = parts[0];
                month = parts[1];
                day = parts[2];
              } else if (parts[2].length === 4 || parts[2].length === 2) {
                // Assume DD-MM-YYYY or DD-MM-YY
                day = parts[0];
                month = parts[1];
                year = parts[2];
                if (year.length === 2) {
                  year = '20' + year;
                }
              } else if (parts[0].length === 2 && parts[1].length === 2 && parts[2].length === 4) {
                // Another check for DD-MM-YYYY
                day = parts[0];
                month = parts[1];
                year = parts[2];
              }
              
              if (day && month && year) {
                limitePago = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
              }
            }
            
            // Final fallback for string: try native Date parser
            if (!limitePago) {
              const parsedDate = new Date(rawDate);
              if (!isNaN(parsedDate.getTime())) {
                // For strings, we might need to be careful, but usually ISO is safer
                limitePago = formatDateToUTCISO(parsedDate);
              }
            }
          }

          // Parse importe
          let importeRaw = getVal('importe') || getVal('valor neto');
          let valorNeto = 0;
          if (typeof importeRaw === 'number') {
            valorNeto = importeRaw;
          } else if (typeof importeRaw === 'string') {
            // Remove currency symbols and format properly
            const cleaned = importeRaw.replace(/[^0-9,.-]+/g, '').replace(',', '.');
            valorNeto = parseFloat(cleaned);
          }

          return {
            operator,
            phNemo: String(getVal('loc. nemo') || getVal('loc. memo') || getVal('nemo') || getVal('memo') || getVal('ph nemo') || ''),
            localizador: String(getVal('localizador') || ''),
            siti: String(getVal('negocio') || getVal('siti') || ''),
            apellido: String(getVal('pasajero') || ''),
            limitePago: limitePago || formatDateToUTCISO(new Date()),
            agente: String(getVal('agente') || ''),
            valorNeto: isNaN(valorNeto) ? 0 : valorNeto,
            isPaid: false
          };
        }).filter(r => r.phNemo || r.localizador || r.apellido); // Filter out empty rows

        resolve(parsedReservations);
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

export async function parsePDFFile(file: File, operator: string): Promise<any[]> {
  return new Promise(async (resolve, reject) => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let fullText = '';

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map((item: any) => item.str).join(' ');
        fullText += pageText + '\n';
      }

      // Basic heuristic parsing for PDF (highly dependent on format)
      // We assume each reservation might be on a single line or separated by specific patterns.
      // This is a fallback and might not work perfectly for all PDF structures.
      const lines = fullText.split('\n').filter(l => l.trim().length > 0);
      const parsedReservations: any[] = [];

      // Example heuristic: looking for lines that might contain a date (limite de pago) and a number (importe)
      const dateRegex = /(\d{4}[\/\-]\d{2}[\/\-]\d{2})|(\d{2}[\/\-]\d{2}[\/\-]\d{2,4})/;
      const currencyRegex = /[$€]?\s?(\d+[.,]\d{2})/;

      lines.forEach(line => {
        if (dateRegex.test(line) && currencyRegex.test(line)) {
          const dateMatch = line.match(dateRegex);
          const currencyMatch = line.match(currencyRegex);
          
          let limitePago = formatDateToLocalISO(new Date());
          if (dateMatch) {
            const rawDate = dateMatch[1];
            const parts = rawDate.split(/[-/]/);
            if (parts.length === 3) {
              let day, month, year;
              if (parts[0].length === 4) {
                // YYYY-MM-DD
                year = parts[0];
                month = parts[1];
                day = parts[2];
              } else {
                // DD-MM-YYYY or DD-MM-YY
                day = parts[0];
                month = parts[1];
                year = parts[2];
                if (year.length === 2) {
                  year = '20' + year;
                }
              }
              limitePago = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
            }
          }

          let valorNeto = 0;
          if (currencyMatch) {
            valorNeto = parseFloat(currencyMatch[1].replace(',', '.'));
          }

          // We extract what we can, but PDF parsing without structure is limited.
          parsedReservations.push({
            operator,
            phNemo: 'Extraído de PDF',
            localizador: 'Revisar',
            siti: 'Revisar',
            apellido: line.substring(0, 20).trim() + '...', // Guessing
            limitePago,
            agente: 'Revisar',
            valorNeto,
            isPaid: false
          });
        }
      });

      if (parsedReservations.length === 0) {
        throw new Error("No se pudo extraer información estructurada del PDF. Se recomienda usar formato Excel (.xlsx, .csv).");
      }

      resolve(parsedReservations);
    } catch (error) {
      reject(error);
    }
  });
}
