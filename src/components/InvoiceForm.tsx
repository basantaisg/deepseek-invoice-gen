import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { Plus, Trash2, Save } from "lucide-react";

interface InvoiceFormProps {
  invoiceId?: string;
  initialData?: any;
}

export const InvoiceForm = ({ invoiceId, initialData }: InvoiceFormProps) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    invoice_number: "",
    vendor_name: "",
    vendor_email: "",
    vendor_address: "",
    client_name: "",
    client_email: "",
    client_address: "",
    issue_date: new Date().toISOString().split("T")[0],
    due_date: "",
    currency: "NPR",
    notes: "",
    terms: "",
    shipping: 0,
  });

  const [lineItems, setLineItems] = useState([
    { description: "", quantity: 1, unit_price: 0, tax_rate: 0 },
  ]);

  useEffect(() => {
    if (initialData) {
      setFormData({
        invoice_number: initialData.invoiceNumber || "",
        vendor_name: initialData.vendor?.name || "",
        vendor_email: initialData.vendor?.email || "",
        vendor_address: initialData.vendor?.address || "",
        client_name: initialData.client?.name || "",
        client_email: initialData.client?.email || "",
        client_address: initialData.client?.address || "",
        issue_date: initialData.issueDate || new Date().toISOString().split("T")[0],
        due_date: initialData.dueDate || "",
        currency: initialData.currency || "NPR",
        notes: initialData.notes || "",
        terms: initialData.terms || "",
        shipping: initialData.shipping || 0,
      });

      if (initialData.items && initialData.items.length > 0) {
        setLineItems(
          initialData.items.map((item: any) => ({
            description: item.description || "",
            quantity: item.quantity || 1,
            unit_price: item.unitPrice || 0,
            tax_rate: item.taxRate || 0,
          }))
        );
      }
    }
  }, [initialData]);

  useEffect(() => {
    if (invoiceId && invoiceId !== "new") {
      loadInvoice();
    }
  }, [invoiceId]);

  const loadInvoice = async () => {
    const { data: invoice, error: invoiceError } = await supabase
      .from("invoices")
      .select("*")
      .eq("id", invoiceId)
      .single();

    if (invoiceError) {
      toast({
        title: "Error",
        description: "Failed to load invoice",
        variant: "destructive",
      });
      return;
    }

    if (invoice) {
      setFormData({
        invoice_number: invoice.invoice_number,
        vendor_name: invoice.vendor_name,
        vendor_email: invoice.vendor_email || "",
        vendor_address: invoice.vendor_address || "",
        client_name: invoice.client_name,
        client_email: invoice.client_email || "",
        client_address: invoice.client_address || "",
        issue_date: invoice.issue_date,
        due_date: invoice.due_date || "",
        currency: invoice.currency,
        notes: invoice.notes || "",
        terms: invoice.terms || "",
        shipping: invoice.shipping || 0,
      });

      const { data: items } = await supabase
        .from("line_items")
        .select("*")
        .eq("invoice_id", invoiceId)
        .order("position");

      if (items && items.length > 0) {
        setLineItems(
          items.map((item) => ({
            description: item.description,
            quantity: Number(item.quantity),
            unit_price: Number(item.unit_price),
            tax_rate: Number(item.tax_rate),
          }))
        );
      }
    }
  };

  const addLineItem = () => {
    setLineItems([
      ...lineItems,
      { description: "", quantity: 1, unit_price: 0, tax_rate: 0 },
    ]);
  };

  const removeLineItem = (index: number) => {
    setLineItems(lineItems.filter((_, i) => i !== index));
  };

  const updateLineItem = (index: number, field: string, value: any) => {
    const updated = [...lineItems];
    updated[index] = { ...updated[index], [field]: value };
    setLineItems(updated);
  };

  const calculateTotals = () => {
    let subtotal = 0;
    let taxTotal = 0;

    lineItems.forEach((item) => {
      const amount = item.quantity * item.unit_price;
      subtotal += amount;
      taxTotal += (amount * item.tax_rate) / 100;
    });

    const grandTotal = subtotal + taxTotal + Number(formData.shipping);

    return { subtotal, taxTotal, grandTotal };
  };

  const handleSave = async () => {
    if (!formData.invoice_number || !formData.vendor_name || !formData.client_name) {
      toast({
        title: "Validation Error",
        description: "Please fill in required fields",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    const { subtotal, taxTotal, grandTotal } = calculateTotals();

    const invoiceData = {
      ...formData,
      subtotal,
      tax_total: taxTotal,
      grand_total: grandTotal,
      user_id: (await supabase.auth.getUser()).data.user?.id,
    };

    try {
      let savedInvoiceId = invoiceId;

      if (invoiceId && invoiceId !== "new") {
        const { error } = await supabase
          .from("invoices")
          .update(invoiceData)
          .eq("id", invoiceId);

        if (error) throw error;

        await supabase.from("line_items").delete().eq("invoice_id", invoiceId);
      } else {
        const { data, error } = await supabase
          .from("invoices")
          .insert(invoiceData)
          .select()
          .single();

        if (error) throw error;
        savedInvoiceId = data.id;
      }

      const itemsToInsert = lineItems.map((item, index) => ({
        invoice_id: savedInvoiceId,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        tax_rate: item.tax_rate,
        amount: item.quantity * item.unit_price,
        position: index,
      }));

      const { error: itemsError } = await supabase
        .from("line_items")
        .insert(itemsToInsert);

      if (itemsError) throw itemsError;

      toast({ title: "Invoice saved successfully" });
      navigate("/dashboard");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to save invoice",
        variant: "destructive",
      });
    }

    setLoading(false);
  };

  const { subtotal, taxTotal, grandTotal } = calculateTotals();

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Invoice Details</h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="invoice_number">Invoice Number *</Label>
            <Input
              id="invoice_number"
              value={formData.invoice_number}
              onChange={(e) =>
                setFormData({ ...formData, invoice_number: e.target.value })
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="currency">Currency</Label>
            <Input
              id="currency"
              value={formData.currency}
              onChange={(e) =>
                setFormData({ ...formData, currency: e.target.value })
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="issue_date">Issue Date *</Label>
            <Input
              id="issue_date"
              type="date"
              value={formData.issue_date}
              onChange={(e) =>
                setFormData({ ...formData, issue_date: e.target.value })
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="due_date">Due Date</Label>
            <Input
              id="due_date"
              type="date"
              value={formData.due_date}
              onChange={(e) =>
                setFormData({ ...formData, due_date: e.target.value })
              }
            />
          </div>
        </div>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">From (Vendor)</h3>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="vendor_name">Business Name *</Label>
              <Input
                id="vendor_name"
                value={formData.vendor_name}
                onChange={(e) =>
                  setFormData({ ...formData, vendor_name: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vendor_email">Email</Label>
              <Input
                id="vendor_email"
                type="email"
                value={formData.vendor_email}
                onChange={(e) =>
                  setFormData({ ...formData, vendor_email: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vendor_address">Address</Label>
              <Textarea
                id="vendor_address"
                value={formData.vendor_address}
                onChange={(e) =>
                  setFormData({ ...formData, vendor_address: e.target.value })
                }
              />
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">To (Client)</h3>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="client_name">Client Name *</Label>
              <Input
                id="client_name"
                value={formData.client_name}
                onChange={(e) =>
                  setFormData({ ...formData, client_name: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="client_email">Email</Label>
              <Input
                id="client_email"
                type="email"
                value={formData.client_email}
                onChange={(e) =>
                  setFormData({ ...formData, client_email: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="client_address">Address</Label>
              <Textarea
                id="client_address"
                value={formData.client_address}
                onChange={(e) =>
                  setFormData({ ...formData, client_address: e.target.value })
                }
              />
            </div>
          </div>
        </Card>
      </div>

      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Line Items</h3>
          <Button onClick={addLineItem} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Add Item
          </Button>
        </div>
        <div className="space-y-4">
          {lineItems.map((item, index) => (
            <div
              key={index}
              className="grid gap-4 md:grid-cols-6 items-end p-4 border rounded-lg"
            >
              <div className="md:col-span-2 space-y-2">
                <Label>Description</Label>
                <Input
                  value={item.description}
                  onChange={(e) =>
                    updateLineItem(index, "description", e.target.value)
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Quantity</Label>
                <Input
                  type="number"
                  value={item.quantity}
                  onChange={(e) =>
                    updateLineItem(index, "quantity", Number(e.target.value))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Unit Price</Label>
                <Input
                  type="number"
                  value={item.unit_price}
                  onChange={(e) =>
                    updateLineItem(index, "unit_price", Number(e.target.value))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Tax %</Label>
                <Input
                  type="number"
                  value={item.tax_rate}
                  onChange={(e) =>
                    updateLineItem(index, "tax_rate", Number(e.target.value))
                  }
                />
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => removeLineItem(index)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Additional Information</h3>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="shipping">Shipping Cost</Label>
            <Input
              id="shipping"
              type="number"
              value={formData.shipping}
              onChange={(e) =>
                setFormData({ ...formData, shipping: Number(e.target.value) })
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) =>
                setFormData({ ...formData, notes: e.target.value })
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="terms">Terms & Conditions</Label>
            <Textarea
              id="terms"
              value={formData.terms}
              onChange={(e) =>
                setFormData({ ...formData, terms: e.target.value })
              }
            />
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Summary</h3>
        <div className="space-y-2 max-w-sm ml-auto">
          <div className="flex justify-between">
            <span>Subtotal:</span>
            <span className="font-medium">
              {formData.currency} {subtotal.toFixed(2)}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Tax:</span>
            <span className="font-medium">
              {formData.currency} {taxTotal.toFixed(2)}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Shipping:</span>
            <span className="font-medium">
              {formData.currency} {formData.shipping.toFixed(2)}
            </span>
          </div>
          <div className="flex justify-between text-lg font-bold border-t pt-2">
            <span>Grand Total:</span>
            <span>
              {formData.currency} {grandTotal.toFixed(2)}
            </span>
          </div>
        </div>
      </Card>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => navigate("/dashboard")}>
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={loading}>
          <Save className="h-4 w-4 mr-2" />
          {loading ? "Saving..." : "Save Invoice"}
        </Button>
      </div>
    </div>
  );
};
