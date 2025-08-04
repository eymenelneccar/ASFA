import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertTriangle, DollarSign, TrendingDown, User } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Customer } from "@shared/schema";

type Props = {
  currency: string;
};

export default function QuickStats({ currency }: Props) {
  const [sortOrder, setSortOrder] = useState<"newest" | "highest">("highest");
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const { toast } = useToast();

  const { data: customers = [], isLoading } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
    retry: false,
  });

  // فلترة العملاء الذين عليهم ديون
  const debtorCustomers = customers
    .filter((customer) => customer.totalDebt && parseFloat(customer.totalDebt) > 0)
    .sort((a, b) => {
      if (sortOrder === "highest") {
        return parseFloat(b.totalDebt ?? "0") - parseFloat(a.totalDebt ?? "0");
      } else {
        // newest - حسب تاريخ الإنشاء
        return new Date(b.createdAt ?? "").getTime() - new Date(a.createdAt ?? "").getTime();
      }
    });

  const paymentMutation = useMutation({
    mutationFn: async ({ customerId, amount }: { customerId: string; amount: number }) => {
      const response = await apiRequest("POST", `/api/customers/${customerId}/payment`, {
        amount,
        currency,
      });
      if (!response.ok) {
        throw new Error("Failed to process payment");
      }
      return response.json();
    },
    onSuccess: (data) => {
      // تحديث فوري للبيانات
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      queryClient.refetchQueries({ queryKey: ["/api/customers"] });
      
      toast({
        title: "تم السداد بنجاح",
        description: `تم دفع ${paymentAmount} ${currency}. الرصيد المتبقي: ${(data.newDebt || 0).toFixed(2)} ${currency}`,
      });
      setShowPaymentModal(false);
      setSelectedCustomer(null);
      setPaymentAmount("");
    },
    onError: () => {
      toast({
        title: "خطأ في السداد",
        description: "فشل في معالجة السداد",
        variant: "destructive",
      });
    },
  });

  const handlePayment = () => {
    if (!selectedCustomer || !paymentAmount) return;

    const amount = parseFloat(paymentAmount);
    if (amount <= 0) {
      toast({
        title: "خطأ",
        description: "يجب أن يكون المبلغ أكبر من صفر",
        variant: "destructive",
      });
      return;
    }

    paymentMutation.mutate({
      customerId: selectedCustomer.id,
      amount,
    });
  };

  const openPaymentModal = (customer: Customer) => {
    setSelectedCustomer(customer);
    setPaymentAmount("");
    setShowPaymentModal(true);
  };

  const formatDebt = (debt: string | null | undefined): string => {
    if (!debt) return "0.00";
    const debtNumber = parseFloat(debt);
    if (isNaN(debtNumber)) return "0.00";
    return debtNumber.toFixed(2);
  };

  const getDebtColor = (debt: string | null | undefined): string => {
    if (!debt) return "text-slate-500";
    const debtNumber = parseFloat(debt);
    if (debtNumber >= 5000) return "text-red-600";
    if (debtNumber >= 1000) return "text-orange-600";
    return "text-yellow-600";
  };

  return (
    <>
      <Card className="shadow-sm border">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <TrendingDown className="h-5 w-5 text-red-600" />
              قائمة الديون
            </CardTitle>
            <Select value={sortOrder} onValueChange={(value: "newest" | "highest") => setSortOrder(value)}>
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder="ترتيب" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="highest">الأكثر ديناً</SelectItem>
                <SelectItem value="newest">الأحدث</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="h-16 bg-slate-200 rounded"></div>
                </div>
              ))}
            </div>
          ) : debtorCustomers.length === 0 ? (
            <div className="text-center py-8">
              <DollarSign className="h-12 w-12 text-green-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-slate-800 mb-2">
                لا توجد ديون
              </h3>
              <p className="text-slate-600">
                جميع العملاء سددوا ديونهم
              </p>
            </div>
          ) : (
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {debtorCustomers.map((customer) => (
                <div
                  key={customer.id}
                  className="flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-red-100 rounded-lg">
                      <User className="h-4 w-4 text-red-600" />
                    </div>
                    <div>
                      <p className="font-medium text-slate-800">
                        {customer.name}
                      </p>
                      <p className="text-sm text-slate-500">
                        ID: {customer.id.slice(0, 8)}...
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className={`font-semibold ${getDebtColor(customer.totalDebt)}`}>
                        {formatDebt(customer.totalDebt)} {currency}
                      </p>
                      <Badge variant="destructive" className="text-xs">
                        <AlertTriangle className="h-3 w-3 mr-1" />
                        دين
                      </Badge>
                    </div>
                    <Button
                      size="sm"
                      className="bg-green-600 hover:bg-green-700 text-white"
                      onClick={() => openPaymentModal(customer)}
                    >
                      سداد
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {debtorCustomers.length > 0 && (
            <div className="mt-4 pt-4 border-t border-slate-200">
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-600">إجمالي العملاء المدينين:</span>
                <Badge variant="secondary">{debtorCustomers.length}</Badge>
              </div>
              <div className="flex justify-between items-center text-sm mt-2">
                <span className="text-slate-600">إجمالي الديون:</span>
                <span className="font-semibold text-red-600">
                  {debtorCustomers
                    .reduce((sum, customer) => sum + parseFloat(customer.totalDebt ?? "0"), 0)
                    .toFixed(2)} {currency}
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payment Modal */}
      <Dialog open={showPaymentModal} onOpenChange={setShowPaymentModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>سداد الدين</DialogTitle>
          </DialogHeader>

          {selectedCustomer && (
            <div className="space-y-4">
              <div className="bg-slate-50 p-4 rounded-lg">
                <h3 className="font-medium mb-2">تفاصيل العميل</h3>
                <p className="text-sm text-slate-600">العميل: {selectedCustomer.name}</p>
                <p className="text-sm font-medium text-red-600">
                  إجمالي الدين: {formatDebt(selectedCustomer.totalDebt)} {currency}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="payment-amount">المبلغ المراد دفعه</Label>
                <Input
                  id="payment-amount"
                  type="number"
                  placeholder="0.00"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  step="0.01"
                  max={selectedCustomer.totalDebt || undefined}
                />
              </div>

              {paymentAmount && (
                <div className="bg-blue-50 p-3 rounded-lg">
                  <p className="text-sm">
                    <span className="text-blue-700">المتبقي بعد السداد: </span>
                    <span className="font-medium text-orange-600">
                      {(parseFloat(selectedCustomer.totalDebt ?? "0") - parseFloat(paymentAmount || "0")).toFixed(2)} {currency}
                    </span>
                  </p>
                </div>
              )}

              <div className="flex gap-2 pt-4">
                <Button
                  className="flex-1 bg-green-600 hover:bg-green-700"
                  onClick={handlePayment}
                  disabled={!paymentAmount || paymentMutation.isPending}
                >
                  {paymentMutation.isPending ? "جارٍ المعالجة..." : "تأكيد السداد"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowPaymentModal(false)}
                  disabled={paymentMutation.isPending}
                >
                  إلغاء
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}