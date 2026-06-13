"use client";

import { useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/layout/stat-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updateSettings } from "@/lib/actions/dashboard";
import { useToast } from "@/hooks/use-toast";
import { Printer } from "lucide-react";

interface SettingsClientProps {
  settings: {
    businessName: string;
    businessAddress: string;
    phone: string;
    email: string;
    receiptFooter: string;
    receiptSize: string;
    receiptAlignment: string;
    receiptFontSize: string;
    receiptBoldText: boolean;
    receiptSpacing: string;
    receiptCompact: boolean;
    taxRate: number;
    currency: string;
  };
}

export function SettingsClient({ settings: initial }: SettingsClientProps) {
  const [loading, setLoading] = useState(false);
  const [receiptSize, setReceiptSize] = useState(initial.receiptSize || "80mm");
  const [receiptAlignment, setReceiptAlignment] = useState(initial.receiptAlignment || "LEFT");
  const [receiptFontSize, setReceiptFontSize] = useState(initial.receiptFontSize || "NORMAL");
  const [receiptBoldText, setReceiptBoldText] = useState(initial.receiptBoldText ?? true);
  const [receiptSpacing, setReceiptSpacing] = useState(initial.receiptSpacing || "NORMAL");
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);
    try {
      await updateSettings({
        businessName: form.get("businessName") as string,
        businessAddress: form.get("businessAddress") as string,
        phone: form.get("phone") as string,
        email: form.get("email") as string,
        receiptFooter: form.get("receiptFooter") as string,
        receiptSize,
        receiptAlignment,
        receiptFontSize,
        receiptBoldText,
        receiptSpacing,
        receiptCompact: receiptSpacing === "COMPACT",
        taxRate: Number(form.get("taxRate")),
        currency: form.get("currency") as string,
      });
      toast({ title: "Settings saved" });
    } catch {
      toast({ title: "Error", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <PageHeader title="Settings" description="Configure your business settings">
        <Link href="/settings/hardware">
          <Button variant="outline" size="sm">
            <Printer className="h-4 w-4 mr-1" />
            Hardware / Printer
          </Button>
        </Link>
      </PageHeader>

      <Card className="max-w-2xl">
        <CardContent className="p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Business Name</Label>
              <Input name="businessName" defaultValue={initial.businessName} required />
            </div>
            <div className="space-y-2">
              <Label>Business Address</Label>
              <Textarea name="businessAddress" defaultValue={initial.businessAddress} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input name="phone" defaultValue={initial.phone} />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input name="email" type="email" defaultValue={initial.email} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tax Rate (%)</Label>
                <Input name="taxRate" type="number" defaultValue={initial.taxRate} />
              </div>
              <div className="space-y-2">
                <Label>Currency</Label>
                <Input name="currency" defaultValue={initial.currency} />
              </div>
            </div>

            <div className="rounded-lg border border-border/60 p-4 space-y-4">
              <p className="font-medium text-sm">Receipt / Printer</p>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Receipt Paper Size</Label>
                  <Select value={receiptSize} onValueChange={setReceiptSize}>
                    <SelectTrigger>
                      <SelectValue placeholder="Paper size" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="58mm">58mm thermal</SelectItem>
                      <SelectItem value="80mm">80mm thermal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Receipt Alignment</Label>
                  <Select value={receiptAlignment} onValueChange={setReceiptAlignment}>
                    <SelectTrigger>
                      <SelectValue placeholder="Alignment" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="LEFT">Left</SelectItem>
                      <SelectItem value="CENTER">Center</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Receipt Font Size</Label>
                  <Select value={receiptFontSize} onValueChange={setReceiptFontSize}>
                    <SelectTrigger>
                      <SelectValue placeholder="Font size" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SMALL">Small</SelectItem>
                      <SelectItem value="NORMAL">Normal</SelectItem>
                      <SelectItem value="LARGE">Large</SelectItem>
                      <SelectItem value="EXTRA_LARGE">Extra Large</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Receipt Spacing</Label>
                  <Select value={receiptSpacing} onValueChange={setReceiptSpacing}>
                    <SelectTrigger>
                      <SelectValue placeholder="Spacing" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="COMPACT">Compact</SelectItem>
                      <SelectItem value="NORMAL">Normal</SelectItem>
                      <SelectItem value="SPACIOUS">Spacious</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  id="receiptBoldText"
                  type="checkbox"
                  checked={receiptBoldText}
                  onChange={(e) => setReceiptBoldText(e.target.checked)}
                  className="h-4 w-4 rounded border-border"
                />
                <Label htmlFor="receiptBoldText">Bold receipt text (high contrast)</Label>
              </div>
              <p className="text-xs text-muted-foreground">
                Tip: use Large font on 58mm paper and Left alignment if text looks small or shifted.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Receipt Footer Message</Label>
              <Textarea name="receiptFooter" defaultValue={initial.receiptFooter} />
            </div>
            <Button type="submit" variant="gold" disabled={loading}>Save Settings</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
