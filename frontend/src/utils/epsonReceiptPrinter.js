import {
  DEFAULT_CURRENCY,
  formatCurrency,
  formatDateTime,
  formatQuantity
} from './formatters.js';

const EPSON_SDK_PATH = '/epson/epos-2.27.0.js';
const RECEIPT_WIDTH = 42;
const DEFAULT_PRINTER_PORT = 8008;
const DEFAULT_DEVICE_ID = 'local_printer';
const SDK_SCRIPT_ID = 'epson-epos-sdk';

let epsonSdkPromise;

export const isEpsonPrinterConfigured = (settings) => (
  Boolean(settings?.printerEnabled && settings?.printerHost)
);

const loadEpsonSdk = () => {
  if (window.epson?.ePOSDevice) {
    return Promise.resolve();
  }

  if (epsonSdkPromise) {
    return epsonSdkPromise;
  }

  epsonSdkPromise = new Promise((resolve, reject) => {
    const existingScript = document.getElementById(SDK_SCRIPT_ID);

    if (existingScript) {
      existingScript.addEventListener('load', () => resolve(), { once: true });
      existingScript.addEventListener('error', () => reject(new Error('Could not load Epson ePOS SDK')), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.id = SDK_SCRIPT_ID;
    script.src = EPSON_SDK_PATH;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Could not load Epson ePOS SDK'));
    document.head.appendChild(script);
  });

  return epsonSdkPromise;
};

const withTimeout = (executor, timeoutMs, timeoutMessage) => (
  new Promise((resolve, reject) => {
    let settled = false;
    const timer = window.setTimeout(() => {
      if (!settled) {
        settled = true;
        reject(new Error(timeoutMessage));
      }
    }, timeoutMs);

    const settle = (handler) => (value) => {
      if (!settled) {
        settled = true;
        window.clearTimeout(timer);
        handler(value);
      }
    };

    executor(settle(resolve), settle(reject));
  })
);

const connectPrinter = async (settings) => {
  await loadEpsonSdk();

  if (!window.epson?.ePOSDevice) {
    throw new Error('Epson ePOS SDK is not available');
  }

  const ePosDevice = new window.epson.ePOSDevice();
  const host = String(settings.printerHost || '').trim();
  const port = String(settings.printerPort || DEFAULT_PRINTER_PORT);
  const deviceId = String(settings.printerDeviceId || DEFAULT_DEVICE_ID).trim() || DEFAULT_DEVICE_ID;
  const options = {
    crypto: Boolean(settings.printerUseSsl),
    buffer: Boolean(settings.printerBuffer)
  };

  const connectCode = await withTimeout((resolve, reject) => {
    ePosDevice.connect(host, port, (code) => {
      if (code === 'OK' || code === 'SSL_CONNECT_OK') {
        resolve(code);
      } else {
        reject(new Error(`Printer connection failed: ${code}`));
      }
    });
  }, 15000, 'Printer connection timed out');

  const printer = await withTimeout((resolve, reject) => {
    ePosDevice.createDevice(deviceId, ePosDevice.DEVICE_TYPE_PRINTER, options, (device, code) => {
      if (device) {
        resolve(device);
      } else {
        reject(new Error(`Printer device failed: ${code}`));
      }
    });
  }, 15000, `Printer device timed out after ${connectCode}`);

  return { ePosDevice, printer };
};

const cleanText = (value) => String(value ?? '')
  .replace(/\r/g, '')
  .replace(/\t/g, ' ')
  .trim();

const line = (char = '-') => char.repeat(RECEIPT_WIDTH);

const splitText = (value, width = RECEIPT_WIDTH) => {
  const text = cleanText(value);

  if (!text) {
    return [];
  }

  const words = text.split(/\s+/);
  const lines = [];
  let current = '';

  words.forEach((word) => {
    if (word.length > width) {
      if (current) {
        lines.push(current);
        current = '';
      }

      for (let index = 0; index < word.length; index += width) {
        lines.push(word.slice(index, index + width));
      }
      return;
    }

    const next = current ? `${current} ${word}` : word;

    if (next.length > width) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  });

  if (current) {
    lines.push(current);
  }

  return lines;
};

const amountLine = (label, amount, currencyCode) => {
  const value = formatCurrency(amount, currencyCode);
  const left = cleanText(label);
  const gap = Math.max(RECEIPT_WIDTH - left.length - value.length, 1);
  return `${left}${' '.repeat(gap)}${value}`;
};

const getStatusText = (printer, status) => {
  if (!status || !printer) {
    return '';
  }

  const flags = [
    [printer.ASB_NO_RESPONSE, 'no printer response'],
    [printer.ASB_OFF_LINE, 'offline'],
    [printer.ASB_COVER_OPEN, 'cover open'],
    [printer.ASB_PAPER_FEED, 'paper feed pressed'],
    [printer.ASB_MECHANICAL_ERR, 'mechanical error'],
    [printer.ASB_AUTOCUTTER_ERR, 'auto cutter error'],
    [printer.ASB_UNRECOVER_ERR, 'unrecoverable error'],
    [printer.ASB_RECEIPT_NEAR_END, 'paper near end'],
    [printer.ASB_RECEIPT_END, 'paper end'],
    [printer.ASB_SPOOLER_IS_STOPPED, 'spooler stopped']
  ];

  return flags
    .filter(([flag]) => flag && (status & flag))
    .map(([, message]) => message)
    .join(', ');
};

const writeReceipt = (printer, invoice) => {
  const currencyCode = invoice.store?.currencyCode || DEFAULT_CURRENCY;
  const paidAmount = Number(invoice.paidAmount || 0);
  const totalAmount = Number(invoice.totalAmount || 0);
  const changeAmount = Math.max(paidAmount - totalAmount, 0);

  printer.addTextLang('en');
  printer.addTextAlign(printer.ALIGN_CENTER);
  printer.addTextStyle(false, false, true, printer.COLOR_1);
  printer.addText(`${cleanText(invoice.store?.storeName || 'Grocery Store')}\n`);
  printer.addTextStyle(false, false, false, printer.COLOR_1);

  splitText(invoice.store?.address).forEach((row) => printer.addText(`${row}\n`));

  if (invoice.store?.phone) {
    printer.addText(`${cleanText(invoice.store.phone)}\n`);
  }

  printer.addText('\n');
  printer.addText(`${cleanText(invoice.invoiceNumber)}\n`);
  printer.addText(`${formatDateTime(invoice.saleDate)}\n`);
  printer.addText(`Customer: ${cleanText(invoice.customer?.name || 'Walk-in')}\n`);
  printer.addText(`${cleanText(invoice.cashier?.name || 'Cashier')}\n`);
  printer.addText(`Payment: ${cleanText(invoice.paymentStatus || 'Paid')}\n`);
  printer.addTextAlign(printer.ALIGN_LEFT);
  printer.addText(`${line()}\n`);

  (invoice.items || []).forEach((item) => {
    splitText(item.productName).forEach((row) => printer.addText(`${row}\n`));
    const quantity = `${formatQuantity(item.quantity)} x ${formatCurrency(item.unitPrice, currencyCode)}`;
    printer.addText(`${amountLine(quantity, item.lineTotal, currencyCode)}\n`);
  });

  printer.addText(`${line()}\n`);
  printer.addText(`${amountLine('Subtotal', invoice.subtotalAmount, currencyCode)}\n`);
  printer.addText(`${amountLine('Discount', invoice.discountAmount, currencyCode)}\n`);
  printer.addText(`${amountLine('Tax', invoice.taxAmount, currencyCode)}\n`);
  printer.addText(`${line()}\n`);
  printer.addTextDouble(true, true);
  printer.addText(`${amountLine('Total', totalAmount, currencyCode)}\n`);
  printer.addTextDouble(false, false);
  printer.addText(`${amountLine('Paid', paidAmount, currencyCode)}\n`);
  printer.addText(`${amountLine('Balance', invoice.balanceAmount, currencyCode)}\n`);
  printer.addText(`${amountLine('Change', changeAmount, currencyCode)}\n`);

  if (invoice.store?.receiptFooter) {
    printer.addText('\n');
    printer.addTextAlign(printer.ALIGN_CENTER);
    splitText(invoice.store.receiptFooter).forEach((row) => printer.addText(`${row}\n`));
    printer.addTextAlign(printer.ALIGN_LEFT);
  }

  printer.addFeedLine(3);
  printer.addCut(printer.CUT_FEED);
};

const sendReceipt = (printer, invoice) => (
  withTimeout((resolve, reject) => {
    printer.onreceive = (response) => {
      if (response.success) {
        resolve(response);
        return;
      }

      const statusText = getStatusText(printer, response.status);
      reject(new Error(`Printer rejected receipt: ${response.code}${statusText ? ` (${statusText})` : ''}`));
    };

    writeReceipt(printer, invoice);
    printer.send();
  }, 25000, 'Printer did not confirm receipt print')
);

export const printReceiptWithEpson = async (invoice) => {
  const settings = invoice.store || {};

  if (!isEpsonPrinterConfigured(settings)) {
    throw new Error('Epson printer is not configured');
  }

  const connection = await connectPrinter(settings);

  try {
    await sendReceipt(connection.printer, invoice);
  } finally {
    if (typeof connection.ePosDevice.disconnect === 'function') {
      connection.ePosDevice.disconnect();
    }
  }
};
