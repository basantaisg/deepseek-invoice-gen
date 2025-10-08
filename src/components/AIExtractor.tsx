import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { Upload, Sparkles } from "lucide-react";
import { InvoiceForm } from "./InvoiceForm";

interface AIExtractorProps {
  invoiceId?: string;
}

export const AIExtractor = ({ invoiceId }: AIExtractorProps) => {
  const [text, setText] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [extractedData, setExtractedData] = useState<any>(null);

  const handleExtract = async () => {
    if (!text.trim()) {
      toast({
        title: "Error",
        description: "Please provide invoice text to extract",
        variant: "destructive",
      });
      return;
    }

    setExtracting(true);

    try {
      const { data, error } = await supabase.functions.invoke("extract-invoice", {
        body: { text },
      });

      if (error) throw error;

      if (data.error) {
        toast({
          title: "Extraction Failed",
          description: data.error,
          variant: "destructive",
        });
      } else {
        setExtractedData(data);
        toast({
          title: "Success",
          description: "Invoice data extracted! Review and edit below.",
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to extract invoice data",
        variant: "destructive",
      });
    }

    setExtracting(false);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            AI Invoice Extraction
          </CardTitle>
          <CardDescription>
            Paste invoice text or upload an image/PDF, and our AI will extract all
            the invoice details automatically
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="invoice-text">Invoice Text</Label>
            <Textarea
              id="invoice-text"
              placeholder="Paste invoice text here or upload a file..."
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={8}
            />
          </div>

          <div className="flex gap-2">
            <Button onClick={handleExtract} disabled={extracting}>
              {extracting ? "Extracting..." : "Extract with AI"}
              <Sparkles className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {extractedData && (
        <Card>
          <CardHeader>
            <CardTitle>Review Extracted Data</CardTitle>
            <CardDescription>
              AI has extracted the following data. Review and edit as needed before
              saving.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <InvoiceForm invoiceId={invoiceId} initialData={extractedData} />
          </CardContent>
        </Card>
      )}
    </div>
  );
};
