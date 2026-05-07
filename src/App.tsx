/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useRef } from 'react';
import { 
  Zap, 
  Home, 
  Coffee, 
  Wind, 
  Calculator, 
  Info,
  ChevronDown,
  ChevronUp,
  FileText,
  Settings,
  RefreshCcw,
  Download,
  Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

interface CustomLoad {
  id: string;
  name: string;
  va: number;
}

interface LoadData {
  // General Information
  address: string;
  serviceRating: number;
  busRating: number;
  
  // 1. General Lighting
  sqft: number;
  smallApplianceCircuits: number;
  laundryCircuits: number;
  
  // 2. Cooking Equipment
  rangeVA: number;
  cooktopVA: number;
  ovenVA: number;
  
  // 3. Electric Dryer
  dryerVA: number;
  
  // 4. Fixed Appliances
  dishwasherVA: number;
  disposalVA: number;
  compactorVA: number;
  waterHeaterVA: number;
  hydroTubVA: number;
  microwaveVA: number;
  builtInVacVA: number;
  customFixedLoads: CustomLoad[];
  
  // 7. Heating or AC
  heatingVA: number;
  acVA: number;

  // System Configuration
  systemVoltage: number;
}

const initialData: LoadData = {
  address: '',
  serviceRating: 200,
  busRating: 225,
  sqft: 0,
  smallApplianceCircuits: 2,
  laundryCircuits: 1,
  rangeVA: 0,
  cooktopVA: 0,
  ovenVA: 0,
  dryerVA: 0,
  dishwasherVA: 0,
  disposalVA: 0,
  compactorVA: 0,
  waterHeaterVA: 0,
  hydroTubVA: 0,
  microwaveVA: 0,
  builtInVacVA: 0,
  customFixedLoads: [],
  heatingVA: 0,
  acVA: 0,
  systemVoltage: 240,
};

export default function App() {
  const [data, setData] = useState<LoadData>(initialData);
  const [isExporting, setIsExporting] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  const calcs = useMemo(() => {
    // 1. General Lighting
    const lightingVA = data.sqft * 3;
    const smallApplianceVA = data.smallApplianceCircuits * 1500;
    const laundryVA = data.laundryCircuits * 1500;
    const generalLightingTotal = lightingVA + smallApplianceVA + laundryVA;

    // 2. Cooking Equipment
    const cookingTotal = data.rangeVA + data.cooktopVA + data.ovenVA;

    // 3. Dryer (min 5000)
    const dryerTotal = data.dryerVA > 0 ? Math.max(5000, data.dryerVA) : 0;

    // 4. Fixed Appliances
    const customFixedTotal = data.customFixedLoads.reduce((sum, load) => sum + load.va, 0);
    const fixedTotal = 
      data.dishwasherVA + 
      data.disposalVA + 
      data.compactorVA + 
      data.waterHeaterVA + 
      data.hydroTubVA + 
      data.microwaveVA + 
      data.builtInVacVA + 
      customFixedTotal;

    // 5. Optional Subtotal
    const optionalSubtotal = generalLightingTotal + cookingTotal + dryerTotal + fixedTotal;

    // 6. Applying Demand Factors
    const first10k = Math.min(optionalSubtotal, 10000);
    const balance = Math.max(0, optionalSubtotal - 10000);
    const demandFactorResult = first10k + (balance * 0.4);

    // 7. Heating or AC (Largest)
    const heatingACResult = Math.max(data.heatingVA, data.acVA);

    // 8. Optional Loads Total
    const totalVA = demandFactorResult + heatingACResult;

    // 9. Minimum Service Size
    const minAmps = totalVA / data.systemVoltage;

    return {
      lightingVA,
      smallApplianceVA,
      laundryVA,
      generalLightingTotal,
      cookingTotal,
      dryerTotal,
      fixedTotal,
      optionalSubtotal,
      demandFactorResult,
      heatingACResult,
      totalVA,
      minAmps
    };
  }, [data]);

  const handleChange = (field: keyof LoadData, value: string | number) => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    setData(prev => ({
      ...prev,
      [field]: isNaN(num) ? 0 : num
    }));
  };

  const exportToPDF = async () => {
    if (!printRef.current) return;
    setIsExporting(true);
    
    try {
      // Small delay to ensure any pending renders are complete
      await new Promise(resolve => setTimeout(resolve, 100));

      const element = printRef.current;
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        windowWidth: 800,
        y: 0,
        scrollX: 0,
        scrollY: 0
      });
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'px',
        format: 'a4'
      });
      
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      
      const imgProps = pdf.getImageProperties(imgData);
      const ratio = imgProps.width / imgProps.height;
      const finalImgHeight = pdfWidth / ratio;
      
      // If content is longer than one page, we could add more pages, 
      // but for this worksheet, one page is usually enough if sized right.
      // We scale it to fit width.
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, finalImgHeight);
      
      const fileName = data.address.trim() 
        ? `wheyland_load_calc_${data.address.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`
        : 'wheyland_load_calc_worksheet.pdf';
        
      pdf.save(fileName);
    } catch (error) {
      console.error('PDF Export failed:', error);
      alert('PDF Export failed. Please try again or use the print function of your browser.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 pb-20">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50 px-4 py-4 sm:px-6 shadow-sm">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center">
              <img src="/logo.png" alt="Wheyland Electric" className="h-12 w-auto" onError={(e) => {
                e.currentTarget.style.display = 'none';
                e.currentTarget.nextElementSibling?.classList.remove('hidden');
              }} />
              <div className="hidden bg-amber-500 p-2 rounded-lg text-white">
                <Zap size={24} />
              </div>
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-800 leading-tight">Wheyland Electric<br className="sm:hidden" /> <span className="text-slate-500">Load Calc Worksheet</span></h1>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">NEC 220.80 Optional Method</p>
            </div>
          </div>
          <div className="flex gap-4 items-center">
            <button 
              onClick={exportToPDF}
              disabled={isExporting}
              className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-xl font-bold text-sm hover:bg-slate-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-slate-900/10"
            >
              {isExporting ? <Loader2 className="animate-spin" size={18} /> : <Download size={18} />}
              <span className="hidden sm:inline">Export PDF</span>
            </button>

            <div className="hidden md:block text-right border-l pl-4 border-slate-100">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Min Service</p>
              <p className={`text-xl font-black leading-none transition-colors ${calcs.minAmps > data.serviceRating ? 'text-red-600' : 'text-emerald-500'}`}>
                {calcs.minAmps.toFixed(1)}A
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Form Sections */}
        <div className="lg:col-span-2 space-y-6">
          
          <Section icon={<Info size={20} />} title="Project Information">
            <div className="space-y-4">
              <InputField 
                label="Property Address" 
                value={data.address} 
                onChange={(v) => setData(prev => ({ ...prev, address: v.toString() }))}
                type="text"
                placeholder="123 Energy Lane"
                fullWidth
              />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t border-slate-100 pt-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block ml-1">
                    System Voltage
                  </label>
                  <div className="flex bg-slate-50 border border-slate-200 rounded-xl p-1 h-[42px]">
                    <button 
                      type="button"
                      onClick={() => setData(prev => ({ ...prev, systemVoltage: 208 }))}
                      className={`flex-1 rounded-lg text-xs font-black transition-all ${data.systemVoltage === 208 ? 'bg-white shadow-sm text-slate-900 border border-slate-100' : 'text-slate-400'}`}
                    >
                      208V
                    </button>
                    <button 
                      type="button"
                      onClick={() => setData(prev => ({ ...prev, systemVoltage: 240 }))}
                      className={`flex-1 rounded-lg text-xs font-black transition-all ${data.systemVoltage === 240 ? 'bg-white shadow-sm text-slate-900 border border-slate-100' : 'text-slate-400'}`}
                    >
                      240V
                    </button>
                  </div>
                </div>
                <InputField 
                  label="Service Rating (A)" 
                  value={data.serviceRating} 
                  onChange={(v) => handleChange('serviceRating', v)}
                />
                <InputField 
                  label="Bus Rating (A)" 
                  value={data.busRating} 
                  onChange={(v) => handleChange('busRating', v)}
                />
              </div>
            </div>
          </Section>

          {/* 1. General Lighting */}
          <Section icon={<Home size={20} />} title="1. General Lighting Loads">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <InputField 
                label="Dwelling Area (sq. ft.)" 
                value={data.sqft} 
                onChange={(v) => handleChange('sqft', v)}
                suffix="× 3 VA"
              />
              <InputField 
                label="Small Appliance Ckts" 
                value={data.smallApplianceCircuits} 
                onChange={(v) => handleChange('smallApplianceCircuits', v)}
                suffix="× 1500 VA"
              />
              <InputField 
                label="Laundry Circuits" 
                value={data.laundryCircuits} 
                onChange={(v) => handleChange('laundryCircuits', v)}
                suffix="× 1500 VA"
              />
            </div>
          </Section>

          {/* 2 & 3. Cooking & Dryer */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Section icon={<Coffee size={20} />} title="2. Cooking Equipment">
              <div className="space-y-4">
                <SmartInputField label="Range" value={data.rangeVA} onChange={(va) => handleChange('rangeVA', va)} />
                <SmartInputField label="Cooktop" value={data.cooktopVA} onChange={(va) => handleChange('cooktopVA', va)} />
                <SmartInputField label="Oven(s)" value={data.ovenVA} onChange={(va) => handleChange('ovenVA', va)} />
              </div>
            </Section>
            
            <Section icon={<Zap size={20} />} title="3. Electric Dryer">
              <SmartInputField 
                label="Dryer" 
                value={data.dryerVA} 
                onChange={(va) => handleChange('dryerVA', va)} 
                helperText="Minimum 5000 VA enforced."
              />
            </Section>
          </div>

          {/* 4. Fixed Appliances */}
          <Section icon={<Settings size={20} />} title="4. Fixed Appliance Loads">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6 mb-8 pb-8 border-b border-slate-100">
              <SmartInputField label="Dishwasher" value={data.dishwasherVA} onChange={(va) => handleChange('dishwasherVA', va)} />
              <SmartInputField label="Disposal" value={data.disposalVA} onChange={(va) => handleChange('disposalVA', va)} />
              <SmartInputField label="Compactor" value={data.compactorVA} onChange={(va) => handleChange('compactorVA', va)} />
              <SmartInputField label="Water Heater" value={data.waterHeaterVA} onChange={(va) => handleChange('waterHeaterVA', va)} />
              <SmartInputField label="Hydromassage Tub" value={data.hydroTubVA} onChange={(va) => handleChange('hydroTubVA', va)} />
              <SmartInputField label="Microwave Oven" value={data.microwaveVA} onChange={(va) => handleChange('microwaveVA', va)} />
              <SmartInputField label="Built-in Vacuum" value={data.builtInVacVA} onChange={(va) => handleChange('builtInVacVA', va)} />
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Other Fixed Loads</h4>
                <button 
                  onClick={() => {
                    setData(prev => ({
                      ...prev,
                      customFixedLoads: [...prev.customFixedLoads, { id: Math.random().toString(36).substring(2, 11), name: '', va: 0 }]
                    }));
                  }}
                  className="text-[10px] font-bold bg-slate-900 text-white px-3 py-1 rounded-full hover:bg-slate-800 transition-colors flex items-center gap-1"
                >
                  <span>+ Add Appliance</span>
                </button>
              </div>

              {data.customFixedLoads.length === 0 && (
                <div className="text-center py-6 border-2 border-dashed border-slate-100 rounded-2xl">
                  <p className="text-xs text-slate-400">No custom fixed loads added yet.</p>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                <AnimatePresence>
                  {data.customFixedLoads.map((load, index) => (
                    <motion.div 
                      key={load.id}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="relative group bg-slate-50/50 p-4 rounded-2xl border border-slate-100"
                    >
                      <div className="space-y-3">
                        <div className="space-y-1">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-tighter ml-1">Appliance Name</label>
                          <input 
                            type="text"
                            value={load.name}
                            placeholder="e.g. Pool Heater, Sauna"
                            onChange={(e) => {
                              const newLoads = [...data.customFixedLoads];
                              newLoads[index].name = e.target.value;
                              setData(prev => ({ ...prev, customFixedLoads: newLoads }));
                            }}
                            className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-bold focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none"
                          />
                        </div>
                        <SmartInputField 
                          label="Value" 
                          value={load.va} 
                          onChange={(va) => {
                            const newLoads = [...data.customFixedLoads];
                            newLoads[index].va = va;
                            setData(prev => ({ ...prev, customFixedLoads: newLoads }));
                          }} 
                        />
                      </div>
                      <button 
                        onClick={() => {
                          setData(prev => ({
                            ...prev,
                            customFixedLoads: prev.customFixedLoads.filter(l => l.id !== load.id)
                          }));
                        }}
                        className="absolute -top-2 -right-2 bg-white border border-slate-200 text-slate-400 hover:text-red-500 p-1.5 rounded-full shadow-sm opacity-0 group-hover:opacity-100 transition-all hover:scale-110"
                      >
                        <RefreshCcw size={12} className="rotate-45" />
                      </button>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>
          </Section>

          {/* 7. Heating or AC */}
          <Section icon={<Wind size={20} />} title="7. Heating or AC Load">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <SmartInputField 
                label="Heating Load" 
                value={data.heatingVA} 
                onChange={(va) => handleChange('heatingVA', va)}
              />
              <SmartInputField 
                label="AC Load" 
                value={data.acVA} 
                onChange={(va) => handleChange('acVA', va)}
              />
            </div>
            <p className="text-xs text-slate-500 mt-4 italic">Note: Only the larger of the two is used in the final calculation.</p>
          </Section>
        </div>

        {/* Right Column: Calculation Summary */}
        <div className="lg:col-span-1">
          <div className="sticky top-24 space-y-6">
            <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
              <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calculator size={18} className="text-amber-400" />
                  <h2 className="font-bold">Summary</h2>
                </div>
                <div className="text-xs opacity-70 font-mono tracking-widest">NEC 220.80</div>
              </div>

              <div className="p-6 space-y-4">
                <SummaryItem label="1. Gen. Lighting Total" value={calcs.generalLightingTotal} />
                <SummaryItem label="2. Cooking Total" value={calcs.cookingTotal} />
                <SummaryItem 
                  label="3. Dryer Total" 
                  value={calcs.dryerTotal} 
                  highlight 
                  note={data.dryerVA > 0 && data.dryerVA < 5000 ? "(MIN 5000VA APPLIED)" : undefined}
                />
                <SummaryItem label="4. Fixed Appliance Total" value={calcs.fixedTotal} />
                
                <div className="pt-4 border-t border-slate-100">
                  <SummaryItem label="5. Optional Subtotal" value={calcs.optionalSubtotal} bold />
                </div>

                <div className="bg-slate-50 p-4 rounded-xl space-y-2 border border-slate-100">
                  <div className="text-[10px] text-slate-400 uppercase font-black tracking-widest">Section 6: Demand Factors</div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">First 10,000 VA @ 100%</span>
                    <span className="font-medium text-slate-900">10,000 VA</span>
                  </div>
                  <div className="flex justify-between text-sm items-start">
                    <div className="flex flex-col">
                      <span className="text-slate-600">Remainder @ 40%</span>
                      {calcs.optionalSubtotal > 10000 && (
                        <span className="text-[10px] text-slate-400 italic">
                          ({(calcs.optionalSubtotal - 10000).toLocaleString()} VA × 0.4)
                        </span>
                      )}
                    </div>
                    <span className="font-medium text-slate-900">
                      {(Math.max(0, calcs.optionalSubtotal - 10000) * 0.4).toLocaleString()} VA
                    </span>
                  </div>
                  <div className="pt-2 border-t border-slate-200 flex justify-between font-bold text-slate-800">
                    <span>Demand Factor Result</span>
                    <span>{calcs.demandFactorResult.toLocaleString()} VA</span>
                  </div>
                </div>

                <SummaryItem label="7. Heating/AC (Max)" value={calcs.heatingACResult} />
                
                <div className="pt-4 mt-4 border-t-2 border-slate-100">
                  <div className="flex justify-between items-end mb-2">
                    <span className="text-sm font-bold text-slate-500 uppercase">Optional Loads Total</span>
                    <span className="text-2xl font-black text-slate-900">{Math.round(calcs.totalVA).toLocaleString()} VA</span>
                  </div>
                  
                  <div className={`p-5 rounded-2xl border-2 flex flex-col items-center text-center transition-all ${calcs.minAmps > data.serviceRating ? 'bg-red-50 border-red-200 text-red-600' : 'bg-emerald-50 border-emerald-200 text-emerald-600'}`}>
                    <span className={`text-[11px] font-black uppercase tracking-[0.2em] mb-1 ${calcs.minAmps > data.serviceRating ? 'text-red-700' : 'text-emerald-700'}`}>Min Service Size</span>
                    <span className="text-5xl font-black tabular-nums">
                      {calcs.minAmps.toFixed(1)}
                      <span className="text-2xl ml-1">A</span>
                    </span>
                    <span className={`text-[10px] mt-2 font-medium ${calcs.minAmps > data.serviceRating ? 'text-red-700' : 'text-emerald-700'}`}>@ {data.systemVoltage} Volts</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl flex gap-3">
              <Info className="text-blue-500 shrink-0" size={20} />
              <p className="text-xs text-blue-800 leading-relaxed">
                This worksheet follows <strong>NEC 220.80 (Optional Method)</strong>. 
                Ensure all nameplate values are entered in Volt-Amps (VA).
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Floating Action Button for Mobile Amps */}
      <div className="fixed bottom-6 right-6 sm:hidden z-50 flex flex-col gap-3">
        <button 
          onClick={exportToPDF}
          className="bg-slate-900 text-white p-4 rounded-full shadow-2xl flex items-center justify-center border-4 border-white"
        >
          {isExporting ? <Loader2 className="animate-spin" size={20} /> : <Download size={20} />}
        </button>
        <div className={`p-4 rounded-full shadow-2xl flex items-center gap-2 border-4 border-white transition-colors ${calcs.minAmps > data.serviceRating ? 'bg-red-600' : 'bg-emerald-500'} text-white`}>
          <Zap size={20} />
          <span className="font-black text-lg">{calcs.minAmps.toFixed(1)}A</span>
        </div>
      </div>

      {/* Hidden Printable Worksheet */}
      <div className="absolute opacity-0 pointer-events-none top-0 left-0 -z-50 overflow-hidden" style={{ width: '800px', height: '1px' }}>
        <div 
          ref={printRef}
          className="w-[800px] bg-white p-12 text-slate-900"
          style={{ fontFamily: 'Inter, sans-serif' }}
        >
          <div className="flex items-center justify-between mb-8 border-b-2 border-slate-900 pb-6">
            <div className="flex items-center gap-4">
              <img src="/logo.png" alt="Wheyland Electric" className="h-20 w-auto" />
              <div className="text-left">
                <h1 className="text-2xl font-black uppercase tracking-tight leading-none">Wheyland Electric</h1>
                <p className="text-xs font-bold text-slate-500 mt-1 uppercase">Load Calculation Worksheet</p>
                <p className="text-[9px] text-slate-400 mt-0.5">License # 940291</p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm font-black bg-slate-900 text-white py-1.5 px-4 inline-block italic">NEC 220.80 OPTIONAL METHOD</div>
              <p className="text-[10px] font-bold text-slate-400 mt-2 uppercase tracking-tighter">Single Family Dwelling</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8 mb-8 pb-4 border-b border-slate-200">
            <div>
              <p className="text-[10px] font-black uppercase text-slate-400 mb-1">Property Address</p>
              <p className="font-bold border-b border-slate-300 pb-1">{data.address || 'N/A'}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-[10px] font-black uppercase text-slate-400 mb-1">Service Rating</p>
                <p className="font-bold border-b border-slate-300 pb-1">{data.serviceRating} Amps</p>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase text-slate-400 mb-1">Bus Rating</p>
                <p className="font-bold border-b border-slate-300 pb-1">{data.busRating} Amps</p>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <PrintSection number="1" title="General Lighting Loads">
              <PrintLine label={`Dwelling Area (${data.sqft} sq. ft. x 3 VA)`} value={calcs.lightingVA} />
              <PrintLine label={`Small appliance loads - 220.16(a) 1500 VA x ${data.smallApplianceCircuits} circuits`} value={calcs.smallApplianceVA} />
              <PrintLine label={`Laundry load - 220-16(b) 1500 VA x ${data.laundryCircuits} circuits`} value={calcs.laundryVA} />
              <PrintTotal label="General Lighting Total" value={calcs.generalLightingTotal} />
            </PrintSection>

            <PrintSection number="2" title="Cooking Equipment Loads - Nameplate Value">
              <PrintLine label="Range" value={data.rangeVA} />
              <PrintLine label="Cooktop" value={data.cooktopVA} />
              <PrintLine label="Oven(s)" value={data.ovenVA} />
              <PrintTotal label="Cooking Equipment Total" value={calcs.cookingTotal} />
            </PrintSection>

            <PrintSection number="3" title="Electric Dryer 220.54 (5000 VA minimum)">
              <PrintTotal label="Dryer Total" value={calcs.dryerTotal} />
            </PrintSection>

            <PrintSection number="4" title="Fixed Appliance Loads 230.30(b)(3)">
              <div className="grid grid-cols-2 gap-x-8 gap-y-1">
                <PrintLine label="Dishwasher" value={data.dishwasherVA} />
                <PrintLine label="Disposal" value={data.disposalVA} />
                <PrintLine label="Compactor" value={data.compactorVA} />
                <PrintLine label="Water Heater" value={data.waterHeaterVA} />
                <PrintLine label="Hydromassage Bathtub" value={data.hydroTubVA} />
                <PrintLine label="Microwave Oven" value={data.microwaveVA} />
                <PrintLine label="Built-in Vacuum" value={data.builtInVacVA} />
                {data.customFixedLoads.map(load => (
                  <React.Fragment key={load.id}>
                    <PrintLine label={load.name || 'Custom Appliance'} value={load.va} />
                  </React.Fragment>
                ))}
              </div>
              <PrintTotal label="Fixed Appliance Total" value={calcs.fixedTotal} />
            </PrintSection>

            <div className="pt-4 border-t-2 border-slate-900">
              <PrintTotal label="5. Optional Subtotal (Add lines 1-4)" value={calcs.optionalSubtotal} large />
            </div>

            <PrintSection number="6" title="Applying Demand Factors 220.82(b)">
              <PrintLine label="First 10,000 VA x 100%" value={10000} />
              <PrintLine label={`Remainder (${Math.max(0, calcs.optionalSubtotal - 10000).toLocaleString()} VA) x 40%`} value={Math.max(0, calcs.optionalSubtotal - 10000) * 0.4} underline />
              <PrintTotal label="Demand Factor Result" value={calcs.demandFactorResult} />
            </PrintSection>

            <PrintSection number="7" title="Heating or AC Load - Table 220.82(c)">
              <PrintLine label={`Larger of Heating (${data.heatingVA.toLocaleString()} VA) or AC (${data.acVA.toLocaleString()} VA)`} value={calcs.heatingACResult} />
            </PrintSection>

            <div className="pt-4 border-t-2 border-slate-900 space-y-4">
              <div className="flex justify-between items-end">
                <span className="text-sm font-black uppercase">8. Optional Loads Total (Add lines 6 and 7)</span>
                <span className="text-xl font-bold border-b-2 border-slate-900 w-32 text-right">{Math.round(calcs.totalVA).toLocaleString()} VA</span>
              </div>
              <div className="bg-slate-50 p-6 border-b-4 border-slate-900">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-lg font-black uppercase tracking-tight">9. Minimum Service Size</h3>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Optional Loads Total / {data.systemVoltage} Volts</p>
                  </div>
                  <div className="text-right">
                    <span className="text-4xl font-black">{calcs.minAmps.toFixed(1)}</span>
                    <span className="text-xl font-bold ml-1">Amps</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-12 text-[9px] text-slate-400 italic">
            * Generated by Wheyland Electric Load Calc - NEC 220.80 Optional Method Worksheet.
            This calculation is for estimating purposes based on user input.
          </div>
        </div>
      </div>
    </div>
  );
}

function PrintSection({ number, title, children }: { number: string, title: string, children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <div className="flex gap-2 items-baseline">
        <span className="font-black text-sm">{number}.</span>
        <h3 className="font-black text-xs uppercase tracking-tight text-slate-700">{title}</h3>
      </div>
      <div className="pl-6 space-y-1">
        {children}
      </div>
    </div>
  );
}

function PrintLine({ label, value, underline = false }: { label: string, value: number, underline?: boolean }) {
  return (
    <div className="flex justify-between items-end text-[11px]">
      <span className="text-slate-600">{label}</span>
      <div className="flex items-end gap-1">
        <span className={`font-medium min-w-[80px] text-right ${underline ? 'border-b border-slate-400' : ''}`}>
          {Math.round(value).toLocaleString()}
        </span>
        <span className="text-slate-400 font-bold text-[9px]">VA</span>
      </div>
    </div>
  );
}

function PrintTotal({ label, value, large = false }: { label: string, value: number, large?: boolean }) {
  return (
    <div className={`flex justify-between items-end mt-1 ${large ? 'py-2' : ''}`}>
      <span className={`${large ? 'text-sm font-black' : 'text-xs font-bold'} uppercase text-slate-800`}>{label}</span>
      <div className="flex items-end gap-1">
        <span className={`${large ? 'text-xl font-black border-b-2' : 'text-[13px] font-black border-b'} border-slate-900 min-w-[100px] text-right`}>
          {Math.round(value).toLocaleString()}
        </span>
        <span className="text-slate-500 font-black text-[10px]">VA</span>
      </div>
    </div>
  );
}

function SmartInputField({ 
  label, 
  value, 
  onChange, 
  helperText 
}: { 
  label: string, 
  value: number, 
  onChange: (va: number) => void,
  helperText?: string
}) {
  const [unit, setUnit] = useState<'VA' | 'Amps'>('VA');
  const [voltage, setVoltage] = useState<'120' | '240'>('240');
  
  // Local state for the text input to keep exactly what the user types
  const [localInput, setLocalInput] = useState<string>(value === 0 ? '' : value.toString());
  const [isFocused, setIsFocused] = useState(false);

  // Sync local input with parent value ONLY when NOT focused
  React.useEffect(() => {
    if (!isFocused) {
      if (value === 0) {
        if (localInput !== '') setLocalInput('');
      } else {
        if (unit === 'VA') {
          // If VA is essentially an integer (it should be), use toString()
          // Otherwise keep precision. Only update if numeric value is different.
          if (parseFloat(localInput) !== value) {
            const roundedValue = Math.round(value);
            if (Math.abs(roundedValue - value) < 0.01) {
              setLocalInput(roundedValue.toString());
            } else {
              setLocalInput(value.toString());
            }
          }
        } else {
          const calculatedAmps = value / Number(voltage);
          // Only update if current display doesn't match the new value
          if (Math.abs(parseFloat(localInput) - calculatedAmps) > 0.001) {
            setLocalInput(Number(calculatedAmps.toFixed(3)).toString());
          }
        }
      }
    }
  }, [value, isFocused, unit, voltage, localInput]);

  const handleUnitToggle = (newUnit: 'VA' | 'Amps') => {
    if (newUnit === unit) return;
    
    if (value > 0) {
      if (newUnit === 'Amps') {
        const amps = value / Number(voltage);
        setLocalInput(Number(amps.toFixed(3)).toString());
      } else {
        setLocalInput(Math.round(value).toString());
      }
    } else {
      setLocalInput('');
    }
    setUnit(newUnit);
  };

  const handleVoltageToggle = (v: '120' | '240') => {
    if (v === voltage) return;
    
    // We want to keep the AMPS constant when switching voltage in AMPS mode
    const currentAmps = value / Number(voltage);
    const newVoltageNum = Number(v);
    
    if (unit === 'Amps' && value > 0) {
      const newVA = Math.round(currentAmps * newVoltageNum);
      onChange(newVA);
      // We don't need to update localInput because currentAmps stays the same
    } else if (unit === 'VA' && value > 0) {
      // If we are in VA mode, the VA stays the same, we just update the voltage toggle
    }
    setVoltage(v);
  };

  const onInputChange = (val: string) => {
    // allow only numbers and one decimal point
    let sanitized = val.replace(/[^0-9.]/g, '');
    const parts = sanitized.split('.');
    if (parts.length > 2) sanitized = parts[0] + '.' + parts.slice(1).join('');
    
    setLocalInput(sanitized);
    
    if (sanitized === '' || sanitized === '.') {
      onChange(0);
      return;
    }
    
    const num = parseFloat(sanitized);
    if (isNaN(num)) return;

    if (unit === 'VA') {
      // Direct VA input
      onChange(num);
    } else {
      // Amps input - calculate VA
      onChange(Math.round(num * Number(voltage)));
    }
  };

  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-center px-1">
        <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
          {label}
        </label>
        <div className="flex bg-slate-100 rounded-full p-0.5 scale-90 origin-right border border-slate-200">
          <button 
            type="button"
            onClick={() => handleUnitToggle('VA')}
            className={`px-2 py-0.5 rounded-full text-[9px] font-black transition-all ${unit === 'VA' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-400'}`}
          >
            VA
          </button>
          <button 
            type="button"
            onClick={() => handleUnitToggle('Amps')}
            className={`px-2 py-0.5 rounded-full text-[9px] font-black transition-all ${unit === 'Amps' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-400'}`}
          >
            AMPS
          </button>
        </div>
      </div>

      <div className="relative group">
        <div className="flex gap-2">
          <input 
            type="text"
            inputMode="decimal"
            value={localInput}
            placeholder="0"
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            onChange={(e) => onInputChange(e.target.value)}
            className={`flex-grow bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all group-hover:bg-white`}
          />
          {unit === 'Amps' && (
            <div className="flex bg-slate-100 rounded-xl p-1 border border-slate-200 shrink-0">
              <button 
                type="button"
                onClick={() => handleVoltageToggle('120')}
                className={`px-2 rounded-lg text-[10px] font-bold transition-all ${voltage === '120' ? 'bg-white shadow-sm text-amber-600' : 'text-slate-400'}`}
              >
                120V
              </button>
              <button 
                type="button"
                onClick={() => handleVoltageToggle('240')}
                className={`px-2 rounded-lg text-[10px] font-bold transition-all ${voltage === '240' ? 'bg-white shadow-sm text-amber-600' : 'text-slate-400'}`}
              >
                240V
              </button>
            </div>
          )}
        </div>
        
        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none pr-28">
           {unit === 'Amps' && value > 0 && (
            <div className="flex items-center gap-1.5 text-[10px] bg-white/80 backdrop-blur px-2 py-1 rounded-md border border-slate-200 translate-x-32">
              <RefreshCcw size={10} className="text-amber-500 animate-pulse" />
              <span className="font-black text-slate-700">{Math.round(value).toLocaleString()} VA</span>
            </div>
           )}
        </div>

        {unit === 'VA' && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 pointer-events-none">
            VA
          </div>
        )}
      </div>

      {helperText && <p className="text-[10px] text-slate-400 ml-1">{helperText}</p>}
    </div>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode, title: string, children: React.ReactNode }) {
  return (
    <motion.section 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden"
    >
      <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center gap-3">
        <div className="text-slate-400">{icon}</div>
        <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wide">{title}</h3>
      </div>
      <div className="p-6">
        {children}
      </div>
    </motion.section>
  );
}

function InputField({ 
  label, 
  value, 
  onChange, 
  type = "number", 
  suffix, 
  placeholder,
  helperText,
  fullWidth = false
}: { 
  label: string, 
  value: string | number, 
  onChange: (v: string | number) => void,
  type?: string,
  suffix?: string,
  placeholder?: string,
  helperText?: string,
  fullWidth?: boolean
}) {
  return (
    <div className={`space-y-1.5 ${fullWidth ? 'w-full' : ''}`}>
      <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block ml-1">
        {label}
      </label>
      <div className="relative group">
        <input 
          type={type}
          value={value === 0 ? '' : value}
          placeholder={placeholder || "0"}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all group-hover:bg-white"
        />
        {suffix && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 pointer-events-none">
            {suffix}
          </div>
        )}
      </div>
      {helperText && <p className="text-[10px] text-slate-400 ml-1">{helperText}</p>}
    </div>
  );
}

function SummaryItem({ label, value, highlight = false, bold = false, note }: { label: string, value: number, highlight?: boolean, bold?: boolean, note?: string }) {
  return (
    <div className="flex justify-between items-center group">
      <div className="flex flex-col">
        <span className={`text-sm ${bold ? 'font-bold text-slate-700' : 'text-slate-500'} group-hover:text-slate-800 transition-colors`}>
          {label}
        </span>
        {note && <span className="text-[9px] font-black text-amber-600 uppercase tracking-tighter">{note}</span>}
      </div>
      <span className={`text-sm tabular-nums ${bold ? 'font-black' : highlight ? 'font-bold text-amber-600' : 'font-medium'}`}>
        {Math.round(value).toLocaleString()} VA
      </span>
    </div>
  );
}
