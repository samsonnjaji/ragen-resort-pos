"use client";

import { useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/layout/stat-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PrinterTestReceipt } from "@/components/settings/printer-test-receipt";
import { ReceiptPrintButton } from "@/components/pos/receipt-print-button";
import {
  detectBluetoothPrinter,
  isWebBluetoothAvailable,
} from "@/lib/print-receipt";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Bluetooth, Printer, ScanBarcode } from "lucide-react";

interface HardwareClientProps {
  settings: {
    businessName: string;
    currency: string;
    receiptSize: string;
    receiptAlignment: string;
    receiptFontSize: string;
    receiptBoldText: boolean;
    receiptSpacing: string;
    receiptCompact: boolean;
  };
}

export function HardwareClient({ settings }: HardwareClientProps) {
  const { toast } = useToast();
  const [scannerTest, setScannerTest] = useState("");
  const [bluetoothDetecting, setBluetoothDetecting] = useState(false);
  const [previewSize, setPreviewSize] = useState<"58mm" | "80mm">(
    settings.receiptSize === "58mm" ? "58mm" : "80mm"
  );
  const [previewFontSize, setPreviewFontSize] = useState<"NORMAL" | "LARGE">("NORMAL");
  const webBluetoothAvailable = isWebBluetoothAvailable();

  const printSettings = {
    receiptSize: settings.receiptSize,
    receiptAlignment: settings.receiptAlignment,
    receiptFontSize: settings.receiptFontSize,
    receiptBoldText: settings.receiptBoldText,
    receiptSpacing: settings.receiptSpacing,
    receiptCompact: settings.receiptCompact,
  };

  const handleDetectBluetooth = async () => {
    setBluetoothDetecting(true);
    try {
      const result = await detectBluetoothPrinter();
      if (result.ok) {
        toast({
          title: "Bluetooth device detected",
          description: result.name ?? "Device found",
        });
      } else {
        toast({
          title: "Detection failed",
          description: result.error,
          variant: "destructive",
        });
      }
    } finally {
      setBluetoothDetecting(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Hardware / Printer"
        description="Configure thermal printers and barcode scanners for Android tablets"
      >
        <Link href="/settings">
          <Button variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Settings
          </Button>
        </Link>
      </PageHeader>

      <div className="grid gap-6 max-w-3xl">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg font-serif">
              <Printer className="h-5 w-5 text-gold" />
              Print Test Receipt
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2 no-print">
              <Button
                size="sm"
                variant={previewSize === "58mm" ? "gold" : "outline"}
                onClick={() => setPreviewSize("58mm")}
              >
                Preview 58mm
              </Button>
              <Button
                size="sm"
                variant={previewSize === "80mm" ? "gold" : "outline"}
                onClick={() => setPreviewSize("80mm")}
              >
                Preview 80mm
              </Button>
              <Button
                size="sm"
                variant={previewFontSize === "NORMAL" ? "gold" : "outline"}
                onClick={() => setPreviewFontSize("NORMAL")}
              >
                Preview Normal
              </Button>
              <Button
                size="sm"
                variant={previewFontSize === "LARGE" ? "gold" : "outline"}
                onClick={() => setPreviewFontSize("LARGE")}
              >
                Preview Large
              </Button>
            </div>
            <PrinterTestReceipt
              businessName={settings.businessName}
              currency={settings.currency}
              previewSize={previewSize}
              previewFontSize={previewFontSize}
              {...printSettings}
            />
            <div className="grid gap-2 sm:grid-cols-2">
              <ReceiptPrintButton
                targetId="printer-test-receipt"
                {...printSettings}
                forceSize="58mm"
                forceFontSize="NORMAL"
                label="Print 58mm Test - Normal"
                variant="outline"
                className="w-full h-12 touch-target"
              />
              <ReceiptPrintButton
                targetId="printer-test-receipt"
                {...printSettings}
                forceSize="58mm"
                forceFontSize="LARGE"
                label="Print 58mm Test - Large"
                variant="outline"
                className="w-full h-12 touch-target"
              />
              <ReceiptPrintButton
                targetId="printer-test-receipt"
                {...printSettings}
                forceSize="80mm"
                forceFontSize="NORMAL"
                label="Print 80mm Test - Normal"
                variant="outline"
                className="w-full h-12 touch-target"
              />
              <ReceiptPrintButton
                targetId="printer-test-receipt"
                {...printSettings}
                forceSize="80mm"
                forceFontSize="LARGE"
                label="Print 80mm Test - Large"
                variant="outline"
                className="w-full h-12 touch-target"
              />
            </div>
            <div className="rounded-lg border border-border/60 bg-muted/30 p-4 text-sm space-y-3">
              <div>
                <p className="font-medium">How to print on Android</p>
                <ol className="list-decimal list-inside space-y-1 text-muted-foreground mt-2">
                  <li>Pair the Bluetooth printer in Android Settings first.</li>
                  <li>Open the POS in Chrome or the installed PWA.</li>
                  <li>Tap a print test button.</li>
                  <li>Select the thermal printer from the Android print dialog.</li>
                  <li>
                    If the printer does not appear, install the printer&apos;s Android print service or app.
                  </li>
                </ol>
              </div>
              <div>
                <p className="font-medium">If receipt is too small or shifted</p>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground mt-2">
                  <li>Use 58mm if your paper is small.</li>
                  <li>Use Large or Extra Large font in Settings.</li>
                  <li>Use Left alignment.</li>
                  <li>Disable Fit to Page.</li>
                  <li>Set scale to 100%.</li>
                  <li>Use margins none or minimum.</li>
                  <li>Use portrait orientation.</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-serif">Bluetooth Thermal Printer</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
              <li>Turn the printer on.</li>
              <li>Pair it with the tablet via Bluetooth settings.</li>
              <li>Install the printer service or app if Android cannot see it.</li>
              <li>Print 58mm and 80mm test receipts from this page.</li>
              <li>
                Set paper size, font size, alignment, spacing, and bold text in{" "}
                <Link href="/settings" className="text-gold underline">
                  Settings
                </Link>.
              </li>
            </ol>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg font-serif">
              <ScanBarcode className="h-5 w-5 text-gold" />
              Barcode Scanner
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
              <li>Use keyboard mode on the scanner.</li>
              <li>Scan into the test input below.</li>
              <li>If the barcode appears, the scanner is working.</li>
            </ul>
            <div className="space-y-2">
              <Label htmlFor="scanner-test">Scanner test input</Label>
              <Input
                id="scanner-test"
                value={scannerTest}
                onChange={(e) => setScannerTest(e.target.value)}
                placeholder="Scan a barcode here…"
                autoComplete="off"
              />
              {scannerTest && (
                <p className="text-sm text-emerald-400">Scanner working — read: {scannerTest}</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-amber-500/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg font-serif">
              <Bluetooth className="h-5 w-5" />
              Experimental: Detect Bluetooth Printer
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-amber-200/90 rounded-md border border-amber-500/30 bg-amber-500/10 p-3">
              Direct Bluetooth printing is experimental. Use the Android print dialog for production.
            </p>
            {webBluetoothAvailable ? (
              <Button
                variant="outline"
                disabled={bluetoothDetecting}
                onClick={handleDetectBluetooth}
              >
                {bluetoothDetecting ? "Detecting…" : "Detect Bluetooth Printer"}
              </Button>
            ) : (
              <p className="text-sm text-muted-foreground">
                Web Bluetooth is not available in this browser. Use the Android print dialog instead.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
