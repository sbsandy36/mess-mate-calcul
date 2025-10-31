import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Calculator, Download, Upload, Trash2, UserPlus, Users } from "lucide-react";
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
    toast.success("Bills calculated successfully");
    
    // Scroll to results
    setTimeout(() => {
      document.getElementById("results")?.scrollIntoView({ behavior: "smooth" });
    }, 100);
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
              <Button onClick={addMember}>
                <UserPlus className="w-4 h-4 mr-2" />
                Add
              </Button>
            </div>

            <div className="space-y-2">
              {members.map((member) => (
                <div key={member.name} className="flex items-center gap-2 p-3 border rounded-lg hover:shadow-sm transition-shadow">
                  <div className="flex-1 font-medium">
                    {member.name}
                    {member.isGuest && (
                      <Badge variant="secondary" className="ml-2">Guest Only</Badge>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {!member.isGuest && (
                      <div className="flex items-center gap-1">
                        <Label className="text-xs text-muted-foreground">Meals:</Label>
                        <Input
                          type="number"
                          value={member.meals}
                          onChange={(e) => updateMember(member.name, "meals", parseFloat(e.target.value) || 0)}
                          onFocus={handleInputFocus}
                          className="w-20 h-8 text-sm"
                        />
                      </div>
                    )}
                    <div className="flex items-center gap-1">
                      <Label className="text-xs text-muted-foreground">Deposit:</Label>
                      <Input
                        type="number"
                        value={member.deposits}
                        onChange={(e) => updateMember(member.name, "deposits", parseFloat(e.target.value) || 0)}
                        onFocus={handleInputFocus}
                        className="w-24 h-8 text-sm"
                      />
                    </div>
                    <div className="flex items-center gap-1">
                      <Label className="text-xs text-muted-foreground">Guest ₹:</Label>
                      <Input
                        type="number"
                        value={member.guest}
                        onChange={(e) => updateMember(member.name, "guest", parseFloat(e.target.value) || 0)}
                        onFocus={handleInputFocus}
                        className="w-24 h-8 text-sm"
                      />
                    </div>
                    <div className="flex items-center gap-1">
                      <Label className="text-xs text-muted-foreground">Fine ₹:</Label>
                      <Input
                        type="number"
                        value={member.fine}
                        onChange={(e) => updateMember(member.name, "fine", parseFloat(e.target.value) || 0)}
                        onFocus={handleInputFocus}
                        className="w-24 h-8 text-sm"
                      />
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeMember(member.name)}
                    className="h-8 w-8"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>

            {members.length === 0 && (
              <p className="text-center text-muted-foreground py-8">No members added yet</p>
            )}

            <div className="flex gap-2 mt-4">
              <Button variant="outline" onClick={exportData} disabled={members.length === 0}>
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
              <Button variant="outline" asChild>
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
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="rice">Rice Cost (₹)</Label>
                <Input
                  id="rice"
                  type="number"
                  value={riceCost}
                  onChange={(e) => setRiceCost(parseFloat(e.target.value) || 0)}
                  onFocus={handleInputFocus}
                />
              </div>
              <div>
                <Label htmlFor="marketing">Marketing Cost (₹)</Label>
                <Input
                  id="marketing"
                  type="number"
                  value={marketingCost}
                  onChange={(e) => setMarketingCost(parseFloat(e.target.value) || 0)}
                  onFocus={handleInputFocus}
                />
              </div>
              <div>
                <Label htmlFor="gas">Gas Cost (₹)</Label>
                <Input
                  id="gas"
                  type="number"
                  value={gasCost}
                  onChange={(e) => setGasCost(parseFloat(e.target.value) || 0)}
                  onFocus={handleInputFocus}
                />
              </div>
              <div>
                <Label htmlFor="paper">Paper Cost (₹)</Label>
                <Input
                  id="paper"
                  type="number"
                  value={paperCost}
                  onChange={(e) => setPaperCost(parseFloat(e.target.value) || 0)}
                  onFocus={handleInputFocus}
                />
              </div>
              <div>
                <Label htmlFor="others">Other Costs (₹)</Label>
                <Input
                  id="others"
                  type="number"
                  value={otherCosts}
                  onChange={(e) => setOtherCosts(parseFloat(e.target.value) || 0)}
                  onFocus={handleInputFocus}
                />
              </div>
              <div>
                <Label htmlFor="boundMeal">Bound Meal (Minimum Meals)</Label>
                <Input
                  id="boundMeal"
                  type="number"
                  value={boundMeal}
                  onChange={(e) => setBoundMeal(parseFloat(e.target.value) || 0)}
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
                  onChange={(e) => handleCookChargeChange(parseFloat(e.target.value) || 0, "total")}
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
                  onChange={(e) => handleCookChargeChange(parseFloat(e.target.value) || 0, "perHead")}
                  onFocus={handleInputFocus}
                  placeholder="Enter per head or total"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Calculate Button */}
        <div className="text-center mb-8">
          <Button 
            size="lg" 
            onClick={calculateBills}
            className="bg-gradient-primary shadow-elevated hover:opacity-90 transition-opacity"
          >
            <Calculator className="w-5 h-5 mr-2" />
            Calculate Bills
          </Button>
        </div>

        {/* Results Section */}
        {results && overview && (
          <div id="results" className="space-y-6">
            {/* Overview Card */}
            <Card className="shadow-elevated border-primary/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calculator className="w-5 h-5" />
                  Calculation Overview
                </CardTitle>
                <CardDescription>Key metrics for this billing period</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-4 gap-4">
                  <div className="p-4 rounded-lg bg-muted/50">
                    <div className="text-sm text-muted-foreground mb-1">Total Members</div>
                    <div className="text-2xl font-bold text-foreground">{overview.totalMembers}</div>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/50">
                    <div className="text-sm text-muted-foreground mb-1">Total Meals</div>
                    <div className="text-2xl font-bold text-foreground">{overview.totalMeals}</div>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/50">
                    <div className="text-sm text-muted-foreground mb-1">Meal Rate</div>
                    <div className="text-2xl font-bold text-foreground">₹{overview.mealRate.toFixed(2)}</div>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/50">
                    <div className="text-sm text-muted-foreground mb-1">Establishment Charge</div>
                    <div className="text-2xl font-bold text-foreground">₹{overview.establishmentCharge.toFixed(2)}</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Individual Bills Card */}
            <Card className="shadow-elevated">
              <CardHeader>
                <CardTitle>Individual Bills</CardTitle>
                <CardDescription>Detailed bill breakdown for all members</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {results.map((member) => (
                    <div key={member.name} className="border rounded-lg p-4 hover:shadow-sm transition-shadow">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h3 className="font-semibold text-lg">{member.name}</h3>
                          {member.isGuest && (
                            <Badge variant="secondary">Guest Only</Badge>
                          )}
                          {!member.isGuest && member.effectiveMeals > member.meals && (
                            <Badge variant="outline" className="ml-2">Min. meals applied</Badge>
                          )}
                        </div>
                        <div className="text-right">
                          <div className="text-sm text-muted-foreground">Outstanding</div>
                          <div className={`text-2xl font-bold ${
                            member.outstanding > 0 ? "text-destructive" : "text-success"
                          }`}>
                            ₹{member.outstanding.toFixed(2)}
                          </div>
                        </div>
                      </div>
                      <Separator className="my-3" />
                      <div className="grid md:grid-cols-2 gap-2 text-sm">
                        {!member.isGuest && (
                          <>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Effective Meals:</span>
                              <span className="font-medium">{member.effectiveMeals}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Meal Cost:</span>
                              <span className="font-medium">₹{member.mealCost.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Establishment Charge:</span>
                              <span className="font-medium">₹{member.establishmentCharge.toFixed(2)}</span>
                            </div>
                          </>
                        )}
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Guest Charges:</span>
                          <span className="font-medium">₹{member.guest.toFixed(2)}</span>
                        </div>
                        {member.fine > 0 && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Fine:</span>
                            <span className="font-medium text-destructive">₹{member.fine.toFixed(2)}</span>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Deposits:</span>
                          <span className="font-medium">₹{member.deposits.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between font-semibold pt-2 border-t">
                          <span>Total Bill:</span>
                          <span>₹{member.totalBill.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};

export default Index;
