import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Calculator, Download, Upload, Trash2, UserPlus, Users, Printer, Share2, History } from "lucide-react";
import { toast } from "sonner";

interface Member {
  name: string;
  meals: number;
  deposits: number;
  guest: number;
  fine: number;
  isGuest: boolean;
}

interface BillResult extends Member {
  effectiveMeals: number;
  mealCost: number;
  establishmentCharge: number;
  totalBill: number;
  outstanding: number;
}

interface OverviewData {
  totalMeals: number;
  mealRate: number;
  totalMembers: number;
  establishmentCharge: number;
}

interface CalculationHistory {
  id: string;
  date: string;
  members: Member[];
  expenses: {
    riceCost: number;
    marketingCost: number;
    gasCost: number;
    paperCost: number;
    otherCosts: number;
    totalCookCharge: number;
    boundMeal: number;
  };
  results: BillResult[];
  overview: OverviewData;
}

const Index = () => {
  const [members, setMembers] = useState<Member[]>([]);
  const [newMember, setNewMember] = useState("");
  const [isGuestMember, setIsGuestMember] = useState(false);
  
  // Expenses
  const [riceCost, setRiceCost] = useState(0);
  const [marketingCost, setMarketingCost] = useState(0);
  const [gasCost, setGasCost] = useState(0);
  const [paperCost, setPaperCost] = useState(0);
  const [otherCosts, setOtherCosts] = useState(0);
  const [totalCookCharge, setTotalCookCharge] = useState(0);
  const [cookRatePerHead, setCookRatePerHead] = useState(0);
  const [messFund, setMessFund] = useState(0);
  const [boundMeal, setBoundMeal] = useState(0);
  const [guestMealRate, setGuestMealRate] = useState(50);
  const [cookChargeMode, setCookChargeMode] = useState<"total" | "perHead">("total");
  
  const [results, setResults] = useState<BillResult[] | null>(null);
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [history, setHistory] = useState<CalculationHistory[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  // Load from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("hostel-members");
    if (saved) {
      try {
        setMembers(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to load members", e);
      }
    }
    
    const savedHistory = localStorage.getItem("hostel-calculation-history");
    if (savedHistory) {
      try {
        setHistory(JSON.parse(savedHistory));
      } catch (e) {
        console.error("Failed to load history", e);
      }
    }
  }, []);

  // Save to localStorage
  useEffect(() => {
    localStorage.setItem("hostel-members", JSON.stringify(members));
  }, [members]);

  const addMember = () => {
    if (!newMember.trim()) {
      toast.error("Please enter a member name");
      return;
    }
    if (members.some(m => m.name.toLowerCase() === newMember.toLowerCase())) {
      toast.error("Member already exists");
      return;
    }
    setMembers([...members, { 
      name: newMember.trim(), 
      meals: 0, 
      deposits: 0, 
      guest: 0,
      fine: 0,
      isGuest: isGuestMember 
    }]);
    setNewMember("");
    setIsGuestMember(false);
    toast.success("Member added");
  };

  const removeMember = (name: string) => {
    setMembers(members.filter(m => m.name !== name));
    toast.success("Member removed");
  };

  const updateMember = (name: string, field: keyof Member, value: number | boolean) => {
    setMembers(members.map(m => 
      m.name === name ? { ...m, [field]: value } : m
    ));
  };

  const calculateBills = () => {
    if (members.length === 0) {
      toast.error("Please add at least one member");
      return;
    }

    const nonGuestMembers = members.filter(m => !m.isGuest);
    
    if (nonGuestMembers.length === 0) {
      toast.error("At least one non-guest member is required");
      return;
    }

    // Calculate total guest meal charge
    const totalGuestMealCharge = members.reduce((sum, m) => sum + m.guest, 0);

    // Calculate effective meals for each member
    const effectiveMeals = members.map(m => ({
      ...m,
      effectiveMeals: m.isGuest ? 0 : Math.max(m.meals, boundMeal)
    }));

    const totalMeals = effectiveMeals.reduce((sum, m) => sum + m.effectiveMeals, 0);

    if (totalMeals === 0) {
      toast.error("Total meals cannot be zero");
      return;
    }

    // Calculate costs
    const totalMarketing = riceCost + marketingCost + gasCost;
    const totalOthers = totalCookCharge + paperCost + otherCosts;

    // Calculate rates
    const mealRate = (totalMarketing - totalGuestMealCharge) / totalMeals;
    const establishmentCharge = totalOthers / nonGuestMembers.length;

    // Calculate individual bills
    const billResults: BillResult[] = effectiveMeals.map(member => {
      const mealCost = member.effectiveMeals * mealRate;
      const estCharge = member.isGuest ? 0 : establishmentCharge;
      const totalBill = mealCost + estCharge + member.guest + member.fine;
      const outstanding = Math.round(totalBill - member.deposits);

      return {
        ...member,
        mealCost,
        establishmentCharge: estCharge,
        totalBill,
        outstanding
      };
    });

    // Set overview data
    setOverview({
      totalMeals,
      mealRate,
      totalMembers: nonGuestMembers.length,
      establishmentCharge
    });

    setResults(billResults);
    
    // Save to history
    const newHistoryEntry: CalculationHistory = {
      id: Date.now().toString(),
      date: new Date().toISOString(),
      members: [...members],
      expenses: {
        riceCost,
        marketingCost,
        gasCost,
        paperCost,
        otherCosts,
        totalCookCharge,
        boundMeal
      },
      results: billResults,
      overview: {
        totalMeals,
        mealRate,
        totalMembers: nonGuestMembers.length,
        establishmentCharge
      }
    };
    
    const updatedHistory = [newHistoryEntry, ...history].slice(0, 10); // Keep last 10 calculations
    setHistory(updatedHistory);
    localStorage.setItem("hostel-calculation-history", JSON.stringify(updatedHistory));
    
    toast.success("Bills calculated successfully");
    
    // Scroll to results
    setTimeout(() => {
      document.getElementById("results")?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  };

  const printResults = () => {
    // Set document title for print filename
    const currentDate = new Date();
    const month = String(currentDate.getMonth() + 1).padStart(2, '0');
    const year = String(currentDate.getFullYear()).slice(-2);
    const originalTitle = document.title;
    document.title = `Mess Bill_${month}/${year}_DevSan`;
    
    window.print();
    
    // Restore original title after print
    setTimeout(() => {
      document.title = originalTitle;
    }, 1000);
    
    toast.success("Opening print dialog");
  };

  const shareViaWhatsApp = () => {
    if (!results || !overview) return;
    
    const currentDate = new Date();
    const month = String(currentDate.getMonth() + 1).padStart(2, '0');
    const year = currentDate.getFullYear();
    
    let message = `*🍽️ Mess Bill Summary - ${month}/${year}*\n\n`;
    message += `*Overview:*\n`;
    message += `Total Members: ${overview.totalMembers}\n`;
    message += `Total Meals: ${overview.totalMeals}\n`;
    message += `Meal Rate: ₹${overview.mealRate.toFixed(2)}\n`;
    message += `Est. Charge: ₹${overview.establishmentCharge.toFixed(2)}\n\n`;
    message += `*Individual Bills:*\n`;
    message += `━━━━━━━━━━━━━━━━\n`;
    
    results.forEach((member) => {
      message += `\n*${member.name}*${member.isGuest ? ' (Guest)' : ''}\n`;
      if (!member.isGuest) {
        message += `Meals: ${member.effectiveMeals} | Cost: ₹${member.mealCost.toFixed(2)}\n`;
        message += `Est. Charge: ₹${member.establishmentCharge.toFixed(2)}\n`;
      }
      if (member.guest > 0) message += `Guest: ₹${member.guest.toFixed(2)}\n`;
      if (member.fine > 0) message += `Fine: ₹${member.fine.toFixed(2)}\n`;
      message += `Deposits: ₹${member.deposits.toFixed(2)}\n`;
      message += `*Total: ₹${member.totalBill.toFixed(2)}*\n`;
      message += `*Outstanding: ₹${member.outstanding.toFixed(2)}*\n`;
    });
    
    message += `\n━━━━━━━━━━━━━━━━\n`;
    message += `Crafted with ❤️ by DevSan`;
    
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
    toast.success("Opening WhatsApp");
  };

  const loadHistoryEntry = (entry: CalculationHistory) => {
    setMembers(entry.members);
    setRiceCost(entry.expenses.riceCost);
    setMarketingCost(entry.expenses.marketingCost);
    setGasCost(entry.expenses.gasCost);
    setPaperCost(entry.expenses.paperCost);
    setOtherCosts(entry.expenses.otherCosts);
    setTotalCookCharge(entry.expenses.totalCookCharge);
    setBoundMeal(entry.expenses.boundMeal);
    setResults(entry.results);
    setOverview(entry.overview);
    setShowHistory(false);
    toast.success("History loaded");
    setTimeout(() => {
      document.getElementById("results")?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  };

  const clearHistory = () => {
    setHistory([]);
    localStorage.removeItem("hostel-calculation-history");
    toast.success("History cleared");
  };

  const downloadDefaultMembers = () => {
    const defaultMembers = [
      { name: "Member 1", meals: 0, deposits: 0, guest: 0, fine: 0, isGuest: false },
      { name: "Member 2", meals: 0, deposits: 0, guest: 0, fine: 0, isGuest: false },
      { name: "Member 3", meals: 0, deposits: 0, guest: 0, fine: 0, isGuest: false }
    ];
    const dataStr = JSON.stringify(defaultMembers, null, 2);
    const dataBlob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "default-members.json";
    link.click();
    toast.success("Default members template downloaded");
  };

  const exportData = () => {
    const dataStr = JSON.stringify(members, null, 2);
    const dataBlob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "mess-members.json";
    link.click();
    toast.success("Data exported");
  };

  const importData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        if (Array.isArray(data)) {
          setMembers(data);
          toast.success("Data imported successfully");
        } else {
          toast.error("Invalid file format");
        }
      } catch (error) {
        toast.error("Failed to import data");
      }
    };
    reader.readAsText(file);
  };

  const handleCookChargeChange = (value: number, mode: "total" | "perHead") => {
    const nonGuestCount = members.filter(m => !m.isGuest).length;
    
    if (mode === "total") {
      setTotalCookCharge(value);
      setCookChargeMode("total");
      if (nonGuestCount > 0) {
        setCookRatePerHead(value / nonGuestCount);
      } else {
        setCookRatePerHead(0);
      }
    } else {
      setCookRatePerHead(value);
      setCookChargeMode("perHead");
      setTotalCookCharge(value * nonGuestCount);
    }
  };

  const handleInputFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    if (e.target.value === "0") {
      e.target.select();
    }
  };

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="container max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-primary mb-4">
            <Calculator className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="text-4xl font-bold mb-2 text-foreground">Santiniketan Mess Calculator</h1>
          <p className="text-muted-foreground text-lg">Transparent hostel bill management & calculation</p>
        </div>

        {/* Members Section */}
        <Card className="mb-6 shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Members Management
            </CardTitle>
            <CardDescription>Add and manage mess members</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2 mb-4">
              <Input
                placeholder="Member name"
                value={newMember}
                onChange={(e) => setNewMember(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addMember()}
                className="flex-1"
              />
              <label className="flex items-center gap-2 px-3 border rounded-md cursor-pointer hover:bg-muted">
                <input
                  type="checkbox"
                  checked={isGuestMember}
                  onChange={(e) => setIsGuestMember(e.target.checked)}
                  className="w-4 h-4"
                />
                <span className="text-sm">Guest Only</span>
              </label>
              <Button onClick={addMember} className="hover:scale-105 transition-transform duration-200">
                <UserPlus className="w-4 h-4 mr-2" />
                Add
              </Button>
            </div>

            <div className="space-y-2">
              {members.map((member) => (
                 <div key={member.name} className="flex flex-col sm:flex-row items-start sm:items-center gap-2 p-2 sm:p-3 border rounded-lg hover:shadow-sm transition-shadow">
                   <div className="flex-1 min-w-0 font-medium text-sm sm:text-base whitespace-nowrap overflow-hidden text-ellipsis">
                     {member.name}
                     {member.isGuest && (
                       <Badge variant="secondary" className="ml-2 text-xs">Guest</Badge>
                     )}
                   </div>
                  <div className="flex flex-wrap gap-1.5 sm:gap-2 w-full sm:w-auto">
                    {!member.isGuest && (
                      <div className="flex items-center gap-1">
                        <Label className="text-xs text-muted-foreground whitespace-nowrap">Meals:</Label>
                        <Input
                          type="number"
                          value={member.meals}
                          onChange={(e) => updateMember(member.name, "meals", parseFloat(e.target.value || "0") || 0)}
                          onFocus={handleInputFocus}
                          className="w-14 sm:w-16 h-8 text-sm"
                        />
                      </div>
                    )}
                    <div className="flex items-center gap-1">
                      <Label className="text-xs text-muted-foreground whitespace-nowrap">Dep:</Label>
                      <Input
                        type="number"
                        value={member.deposits}
                        onChange={(e) => updateMember(member.name, "deposits", parseFloat(e.target.value || "0") || 0)}
                        onFocus={handleInputFocus}
                        className="w-16 sm:w-20 h-8 text-sm"
                      />
                    </div>
                    <div className="flex items-center gap-1">
                      <Label className="text-xs text-muted-foreground whitespace-nowrap">Guest:</Label>
                      <Input
                        type="number"
                        value={member.guest}
                        onChange={(e) => updateMember(member.name, "guest", parseFloat(e.target.value || "0") || 0)}
                        onFocus={handleInputFocus}
                        className="w-16 sm:w-20 h-8 text-sm"
                      />
                    </div>
                    <div className="flex items-center gap-1">
                      <Label className="text-xs text-muted-foreground whitespace-nowrap">Fine:</Label>
                      <Input
                        type="number"
                        value={member.fine}
                        onChange={(e) => updateMember(member.name, "fine", parseFloat(e.target.value || "0") || 0)}
                        onFocus={handleInputFocus}
                        className="w-16 sm:w-20 h-8 text-sm"
                      />
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeMember(member.name)}
                    className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>

            {members.length === 0 && (
              <p className="text-center text-muted-foreground py-8">No members added yet</p>
            )}

            <div className="flex flex-wrap gap-2 mt-4">
              <Button variant="outline" onClick={exportData} disabled={members.length === 0} className="hover:bg-primary/10 hover:border-primary transition-colors">
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
              <Button variant="outline" asChild className="hover:bg-primary/10 hover:border-primary transition-colors">
                <label className="cursor-pointer">
                  <Upload className="w-4 h-4 mr-2" />
                  Import
                  <input
                    type="file"
                    accept=".json"
                    onChange={importData}
                    className="hidden"
                  />
                </label>
              </Button>
              <Button variant="outline" onClick={downloadDefaultMembers} className="hover:bg-primary/10 hover:border-primary transition-colors">
                <Download className="w-4 h-4 mr-2" />
                Download Template
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Expenses Section */}
        <Card className="mb-6 shadow-card">
          <CardHeader>
            <CardTitle>Expenses</CardTitle>
            <CardDescription>Enter all mess expenses for the period</CardDescription>
          </CardHeader>
              <CardContent>
                <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="rice">Rice Cost (₹)</Label>
                <Input
                  id="rice"
                  type="number"
                  value={riceCost}
                  onChange={(e) => setRiceCost(parseFloat(e.target.value || "0") || 0)}
                  onFocus={handleInputFocus}
                />
              </div>
              <div>
                <Label htmlFor="marketing">Marketing Cost (₹)</Label>
                <Input
                  id="marketing"
                  type="number"
                  value={marketingCost}
                  onChange={(e) => setMarketingCost(parseFloat(e.target.value || "0") || 0)}
                  onFocus={handleInputFocus}
                />
              </div>
              <div>
                <Label htmlFor="gas">Gas Cost (₹)</Label>
                <Input
                  id="gas"
                  type="number"
                  value={gasCost}
                  onChange={(e) => setGasCost(parseFloat(e.target.value || "0") || 0)}
                  onFocus={handleInputFocus}
                />
              </div>
              <div>
                <Label htmlFor="paper">Paper Cost (₹)</Label>
                <Input
                  id="paper"
                  type="number"
                  value={paperCost}
                  onChange={(e) => setPaperCost(parseFloat(e.target.value || "0") || 0)}
                  onFocus={handleInputFocus}
                />
              </div>
              <div>
                <Label htmlFor="others">Other Costs (₹)</Label>
                <Input
                  id="others"
                  type="number"
                  value={otherCosts}
                  onChange={(e) => setOtherCosts(parseFloat(e.target.value || "0") || 0)}
                  onFocus={handleInputFocus}
                />
              </div>
              <div>
                <Label htmlFor="boundMeal">Bound Meal (Minimum Meals)</Label>
                <Input
                  id="boundMeal"
                  type="number"
                  value={boundMeal}
                  onChange={(e) => setBoundMeal(parseFloat(e.target.value || "0") || 0)}
                  onFocus={handleInputFocus}
                />
              </div>
              <div>
                <Label htmlFor="cookTotal">
                  Total Cook Charge (₹) - Optional
                  {cookChargeMode === "perHead" && totalCookCharge > 0 && (
                    <Badge variant="secondary" className="ml-2 text-xs">Auto-calculated</Badge>
                  )}
                </Label>
                <Input
                  id="cookTotal"
                  type="number"
                  value={totalCookCharge}
                  onChange={(e) => handleCookChargeChange(parseFloat(e.target.value || "0") || 0, "total")}
                  onFocus={handleInputFocus}
                  placeholder="Enter total or per head"
                />
              </div>
              <div>
                <Label htmlFor="cookRate">
                  Cook Rate per Head (₹) - Optional
                  {cookChargeMode === "total" && cookRatePerHead > 0 && (
                    <Badge variant="secondary" className="ml-2 text-xs">Auto-calculated</Badge>
                  )}
                </Label>
                <Input
                  id="cookRate"
                  type="number"
                  value={cookRatePerHead}
                  onChange={(e) => handleCookChargeChange(parseFloat(e.target.value || "0") || 0, "perHead")}
                  onFocus={handleInputFocus}
                  placeholder="Enter per head or total"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Calculate and History Buttons */}
        <div className="flex flex-col sm:flex-row justify-center items-center gap-3 mb-8">
          <Button 
            size="lg" 
            onClick={calculateBills}
            className="bg-gradient-primary shadow-elevated hover:opacity-90 hover:scale-105 transition-all duration-200"
          >
            <Calculator className="w-5 h-5 mr-2" />
            Calculate Bills
          </Button>
          <Button 
            variant="outline"
            size="lg"
            onClick={() => setShowHistory(!showHistory)}
            className="hover:bg-primary/10 hover:border-primary hover:scale-105 transition-all duration-200"
          >
            <History className="w-5 h-5 mr-2" />
            History ({history.length})
          </Button>
        </div>

        {/* History Section */}
        {showHistory && history.length > 0 && (
          <Card className="mb-6 shadow-card">
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Calculation History</CardTitle>
                  <CardDescription>View and load past calculations</CardDescription>
                </div>
                <Button variant="destructive" size="sm" onClick={clearHistory}>
                  Clear All
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {history.map((entry) => (
                  <div key={entry.id} className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 p-3 border rounded-lg hover:shadow-sm transition-shadow">
                    <div className="flex-1">
                      <div className="font-medium text-sm">
                        {new Date(entry.date).toLocaleDateString('en-IN', { 
                          day: '2-digit', 
                          month: 'short', 
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {entry.results.length} members • ₹{entry.overview.mealRate.toFixed(2)}/meal
                      </div>
                    </div>
                    <Button 
                      size="sm" 
                      onClick={() => loadHistoryEntry(entry)}
                      className="hover:scale-105 transition-transform"
                    >
                      Load
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Results Section */}
        {results && overview && (
          <div id="results" className="space-y-6">
            {/* Action Buttons */}
            <div className="flex flex-wrap justify-center gap-3 print:hidden">
              <Button 
                variant="outline"
                size="lg" 
                onClick={printResults}
                className="gap-2 hover:bg-primary/10 hover:border-primary hover:scale-105 transition-all duration-200"
              >
                <Printer className="w-5 h-5" />
                Print / Save as PDF
              </Button>
              <Button 
                variant="outline"
                size="lg" 
                onClick={shareViaWhatsApp}
                className="gap-2 hover:bg-success/10 hover:border-success hover:scale-105 transition-all duration-200"
              >
                <Share2 className="w-5 h-5" />
                Share via WhatsApp
              </Button>
            </div>

            {/* Overview Card */}
            <Card className="shadow-elevated border-primary/20 print:shadow-none print:border print:break-inside-avoid">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calculator className="w-5 h-5" />
                  Calculation Overview
                </CardTitle>
                <CardDescription>Key metrics for this billing period</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 rounded-lg bg-muted/50">
                    <div className="text-xs text-muted-foreground mb-1">Total Members</div>
                    <div className="text-xl font-bold text-foreground">{overview.totalMembers}</div>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50">
                    <div className="text-xs text-muted-foreground mb-1">Total Meals</div>
                    <div className="text-xl font-bold text-foreground">{overview.totalMeals}</div>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50">
                    <div className="text-xs text-muted-foreground mb-1">Meal Rate</div>
                    <div className="text-xl font-bold text-foreground">₹{overview.mealRate.toFixed(2)}</div>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50">
                    <div className="text-xs text-muted-foreground mb-1">Est. Charge</div>
                    <div className="text-xl font-bold text-foreground">₹{overview.establishmentCharge.toFixed(2)}</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Individual Bills Table */}
            <Card className="shadow-elevated print:break-inside-avoid">
              <CardHeader className="pb-2">
                <CardTitle className="text-base sm:text-lg">Individual Bills</CardTitle>
                <CardDescription className="text-xs">Detailed breakdown</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                     <tr className="border-b-2 border-border">
                        <th className="text-left p-2 font-semibold">Name</th>
                        <th className="text-right p-2 font-semibold hidden sm:table-cell">Actual Meals</th>
                        <th className="text-right p-2 font-semibold hidden sm:table-cell">Meals</th>
                        <th className="text-right p-2 font-semibold hidden sm:table-cell">M.Cost</th>
                        <th className="text-right p-2 font-semibold hidden sm:table-cell">Est.</th>
                        <th className="text-right p-2 font-semibold hidden sm:table-cell">Guest</th>
                        <th className="text-right p-2 font-semibold hidden sm:table-cell">Fine</th>
                        <th className="text-right p-2 font-semibold hidden sm:table-cell">Dep.</th>
                        <th className="text-right p-2 font-semibold">Total</th>
                        <th className="text-right p-2 font-semibold">Outstanding</th>
                      </tr>
                    </thead>
                    <tbody>
                      {results.map((member) => (
                        <tr key={member.name} className="border-b border-border hover:bg-muted/30 transition-colors print:break-inside-avoid">
                          <td className="p-2">
                            <div className="font-medium">{member.name}</div>
                            <div className="flex gap-1 mt-0.5">
                              {member.isGuest && (
                                <Badge variant="secondary" className="text-[8px] py-0 px-1">G</Badge>
                              )}
                              {!member.isGuest && member.effectiveMeals > member.meals && (
                                <Badge variant="outline" className="text-[8px] py-0 px-1">Min</Badge>
                              )}
                            </div>
                            {/* Mobile view details */}
                            <div className="sm:hidden text-[10px] text-muted-foreground mt-1 space-y-0.5">
                              {!member.isGuest && (
                                <div>M: {member.effectiveMeals} • C: ₹{member.mealCost.toFixed(2)} • E: ₹{member.establishmentCharge.toFixed(2)}</div>
                              )}
                              <div>G: ₹{member.guest.toFixed(2)} • F: ₹{member.fine.toFixed(2)} • D: ₹{member.deposits.toFixed(2)}</div>
                            </div>
                          </td>
                           <td className="text-right p-2 hidden sm:table-cell">
                             {member.isGuest ? "-" : member.meals}
                           </td>
                           <td className="text-right p-2 hidden sm:table-cell">
                             {member.isGuest ? "-" : member.effectiveMeals}
                           </td>
                          <td className="text-right p-2 hidden sm:table-cell">
                            {member.isGuest ? "-" : `₹${member.mealCost.toFixed(2)}`}
                          </td>
                          <td className="text-right p-2 hidden sm:table-cell">
                            {member.isGuest ? "-" : `₹${member.establishmentCharge.toFixed(2)}`}
                          </td>
                          <td className="text-right p-2 hidden sm:table-cell">
                            ₹{member.guest.toFixed(2)}
                          </td>
                          <td className="text-right p-2 hidden sm:table-cell">
                            {member.fine > 0 ? (
                              <span className="text-destructive">₹{member.fine.toFixed(2)}</span>
                            ) : "-"}
                          </td>
                          <td className="text-right p-2 hidden sm:table-cell">
                            ₹{member.deposits.toFixed(2)}
                          </td>
                          <td className="text-right p-2 font-semibold">
                            ₹{member.totalBill.toFixed(2)}
                          </td>
                          <td className={`text-right p-2 font-bold ${
                            member.outstanding > 0 ? "text-destructive" : "text-success"
                          }`}>
                            ₹{member.outstanding.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Footer */}
        <footer className="text-center py-6 mt-8 text-sm text-muted-foreground print:mt-4">
          Crafted with ❤️ by <span className="font-semibold text-foreground">DevSan (Sandipan Bera)</span>
        </footer>
      </div>
    </div>
  );
};

export default Index;
