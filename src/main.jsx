import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { LayoutDashboard, Users, CalendarDays, ClipboardList, Settings, Search, Plus, MoreHorizontal, BookOpen, Star, X, GraduationCap, Clock3, ArrowRight, FileText, CalendarCheck, ChevronLeft, Trash2, Save, UserRound } from 'lucide-react';
import './style.css';
import { supabase } from './supabase';

const initialStudents = [];
const days = ['شنبه','یکشنبه','دوشنبه','سه‌شنبه','چهارشنبه','پنجشنبه','جمعه'];
const blocks = [{id:'b1',title:'بازه اول',time:'۰۷:۰۰ تا ۱۴:۰۰'},{id:'b2',title:'بازه دوم',time:'۱۵:۳۰ تا ۲۰:۰۰'},{id:'b3',title:'بازه سوم',time:'۲۱:۰۰ تا ۲۳:۳۰'}];
const blankPlan = () => days.map(day => ({day, blocks: blocks.map(b => ({...b, lessons: []}))}));

const jalaliParts = date => {
  const parts = new Intl.DateTimeFormat('en-US-u-ca-persian', {
    year: 'numeric', month: 'numeric', day: 'numeric'
  }).formatToParts(date);
  return {
    year: Number(parts.find(p => p.type === 'year').value),
    month: Number(parts.find(p => p.type === 'month').value),
    day: Number(parts.find(p => p.type === 'day').value)
  };
};
const jalaliMonthStart = (year, month) => {
  const monthIndex = month + 1;
  const gregorianYear = year + 621 + (monthIndex >= 12 ? 1 : 0);
  const gregorianMonth = monthIndex % 12;
  const start = new Date(gregorianYear, gregorianMonth, 1, 12);
  for (let i = 0; i < 40; i++) {
    const candidate = new Date(start);
    candidate.setDate(start.getDate() + i);
    const p = jalaliParts(candidate);
    if (p.year === year && p.month === month && p.day === 1) return candidate;
  }
  return new Date();
};
const toIsoDate = date => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};
const formatJalaliDate = iso => {
  if (!iso) return '—';
  const date = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(date.getTime())) return iso;
  const p = jalaliParts(date);
  return `${p.year}/${String(p.month).padStart(2, '0')}/${String(p.day).padStart(2, '0')}`
    .replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]);
};

function JalaliDatePicker({ value, onChange, label, required = false }) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(() => value ? new Date(`${value}T12:00:00`) : new Date());
  useEffect(() => {
    if (value) setView(new Date(`${value}T12:00:00`));
  }, [value]);
  const current = jalaliParts(view);
  const first = jalaliMonthStart(current.year, current.month);
  const firstParts = jalaliParts(first);
  const offset = (first.getDay() + 1) % 7;
  const daysInMonth = (() => {
    for (let day = 1; day <= 31; day++) {
      const candidate = new Date(first);
      candidate.setDate(first.getDate() + day);
      const p = jalaliParts(candidate);
      if (p.year !== current.year || p.month !== current.month) return day;
    }
    return 31;
  })();
  const monthNames = ['فروردین','اردیبهشت','خرداد','تیر','مرداد','شهریور','مهر','آبان','آذر','دی','بهمن','اسفند'];
  const moveMonth = delta => {
    let y = current.year;
    let m = current.month + delta;
    if (m < 1) { m = 12; y -= 1; }
    if (m > 12) { m = 1; y += 1; }
    setView(jalaliMonthStart(y, m));
  };
  return <label className="jalali-picker-label">{label}
    <button type="button" className="jalali-picker-input" onClick={() => setOpen(v => !v)}>
      <span>{value ? formatJalaliDate(value) : 'انتخاب تاریخ شمسی'}</span>
      <CalendarDays size={16}/>
    </button>
    {open && <div className="jalali-calendar">
      <div className="jalali-calendar-head">
        <button type="button" onClick={() => moveMonth(-1)} aria-label="ماه قبل">‹</button>
        <b>{monthNames[current.month - 1]} {current.year.toLocaleString('fa-IR')}</b>
        <button type="button" onClick={() => moveMonth(1)} aria-label="ماه بعد">›</button>
      </div>
      <div className="jalali-calendar-grid jalali-weekdays">
        {['ش','ی','د','س','چ','پ','ج'].map((day, i) => <span key={i}>{day}</span>)}
      </div>
      <div className="jalali-calendar-grid">
        {Array.from({ length: offset }, (_, i) => <span key={`blank-${i}`} />)}
        {Array.from({ length: daysInMonth }, (_, i) => {
          const day = i + 1;
          const date = new Date(first);
          date.setDate(first.getDate() + i);
          const iso = toIsoDate(date);
          const selected = value === iso;
          return <button type="button" key={day} className={selected ? 'selected' : ''} onClick={() => { onChange(iso); setOpen(false); }}>
            {day.toLocaleString('fa-IR')}
          </button>;
        })}
      </div>
      <div className="jalali-calendar-foot">
        <button type="button" onClick={() => { onChange(''); setOpen(false); }}>پاک کردن</button>
        <button type="button" onClick={() => { const today = new Date(); onChange(toIsoDate(today)); setView(today); setOpen(false); }}>امروز</button>
      </div>
    </div>}
  </label>;
}

const activityOptions = ['مطالعه', 'تست', 'تحلیل', 'جزوه‌نویسی', 'ویدیو آموزشی', 'مرور'];
const formatActivity = activity => Array.isArray(activity) ? activity.join('، ') : (activity || '—');
const formatDuration = lesson => lesson?.duration === 'غیره'
  ? (lesson.durationOther || 'مدت دلخواه')
  : (lesson?.duration || 'مدت نامشخص');

const toEnglishDigits = value => String(value ?? '').replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
const studentLoginEmail = nationalId => `${toEnglishDigits(nationalId).replace(/\D/g, '')}@students.edupanel.local`;


function ManagerApp({ profile, onSignOut }) {
  const [students, setStudents] = useState(initialStudents);
  const [studentsLoading, setStudentsLoading] = useState(true);
  const [studentsError, setStudentsError] = useState('');
  const [contractsByStudent, setContractsByStudent] = useState({});
  const [contractsLoading, setContractsLoading] = useState(false);
  const [contractsError, setContractsError] = useState('');
  const [showContractForm, setShowContractForm] = useState(false);
  const [contractSaving, setContractSaving] = useState(false);
  const [contractDraft, setContractDraft] = useState({amount:'', planCount:'4', startDate:'', endDate:'', notes:''});
  const [editingStudentId, setEditingStudentId] = useState(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('همه');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name:'', field:'', grade:'دوازدهم', nationalId:'', phone:'', type:'عادی' });
  const [active, setActive] = useState('دانش‌آموزان');
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [profileTab, setProfileTab] = useState('overview');
  const [plans, setPlans] = useState({});
  const [plansLoading, setPlansLoading] = useState(false);
  const [plansError, setPlansError] = useState('');
  const [editingPlanId, setEditingPlanId] = useState(null);
  const [finance, setFinance] = useState({});
  const [viewingPlan, setViewingPlan] = useState(null);
  const [paymentDraft, setPaymentDraft] = useState({amount:'', date:'', note:''});
  const [portalMode, setPortalMode] = useState(false);
  const [portalStudentId, setPortalStudentId] = useState(1);
  const [reportDate, setReportDate] = useState('');
  const [reportItems, setReportItems] = useState([]);
  const [reportUnread, setReportUnread] = useState('ندارم');
  const [receiptFile, setReceiptFile] = useState(null);
  const [receiptAmount, setReceiptAmount] = useState('');
  const [receiptDate, setReceiptDate] = useState('');
  const [receiptNote, setReceiptNote] = useState('');
  const [studentReports, setStudentReports] = useState({});
  const [reportsError, setReportsError] = useState('');
  const [receipts, setReceipts] = useState({});
  const [editingPlan, setEditingPlan] = useState(false);
  const [planStart, setPlanStart] = useState('');
  const [planEnd, setPlanEnd] = useState('');
  const [planTitle, setPlanTitle] = useState('برنامه هفتگی');
  const [planDays, setPlanDays] = useState(blankPlan());
  const [activeDay, setActiveDay] = useState('شنبه');

  useEffect(() => {
    let cancelled = false;
    const loadStudents = async () => {
      setStudentsLoading(true);
      setStudentsError('');
      const { data, error } = await supabase
        .from('students')
        .select('id,user_id,full_name,field,student_type,national_id,phone,notes,created_at,grade')
        .order('created_at', { ascending: false });
      if (cancelled) return;
      if (error) {
        setStudentsError('بارگذاری دانش‌آموزان ناموفق بود: ' + error.message);
      } else {
        setStudents(data.map(row => ({
          id: row.id,
          userId: row.user_id,
          name: row.full_name,
          field: row.field,
          grade: row.grade || '—',
          nationalId: row.national_id || '',
          phone: row.phone || '',
          notes: row.notes || '',
          type: row.student_type === 'special' ? 'ویژه' : 'عادی'
        })));
      }
      setStudentsLoading(false);
    };
    loadStudents();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadContracts = async () => {
      setContractsLoading(true);
      setContractsError('');
      const { data, error } = await supabase
        .from('contracts')
        .select('id,student_id,amount,plan_count,duration_days,start_date,end_date,notes,created_at,previous_contract_id')
        .order('created_at', { ascending: false });
      if (cancelled) return;
      if (error) {
        setContractsError('بارگذاری قراردادها ناموفق بود: ' + error.message);
      } else {
        const grouped = {};
        (data || []).forEach(contract => {
          grouped[contract.student_id] = [...(grouped[contract.student_id] || []), contract];
        });
        setContractsByStudent(grouped);
      }
      setContractsLoading(false);
    };
    loadContracts();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadPlans = async () => {
      setPlansLoading(true);
      setPlansError('');
      const { data, error } = await supabase
        .from('weekly_plans')
        .select('id,student_id,title,start_date,end_date,days,created_at')
        .order('created_at', { ascending: false });
      if (cancelled) return;
      if (error) {
        setPlansError('بارگذاری برنامه‌های هفتگی ناموفق بود: ' + error.message);
      } else {
        const grouped = {};
        (data || []).forEach(row => {
          const plan = { id: row.id, title: row.title, start: row.start_date || '', end: row.end_date || '', days: Array.isArray(row.days) ? row.days : [] };
          grouped[row.student_id] = [...(grouped[row.student_id] || []), plan];
        });
        setPlans(grouped);
      }
      setPlansLoading(false);
    };
    loadPlans();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadReports = async () => {
      const { data, error } = await supabase
        .from('daily_reports')
        .select('id,student_id,report_date,items,unread,created_at')
        .order('report_date', { ascending: false })
        .order('created_at', { ascending: false });
      if (cancelled) return;
      if (error) {
        setReportsError('بارگذاری گزارش‌های روزانه ناموفق بود: ' + error.message);
        return;
      }
      const grouped = {};
      (data || []).forEach(row => {
        const report = {
          id: row.id,
          date: row.report_date,
          items: Array.isArray(row.items) ? row.items : [],
          unread: row.unread || '',
          createdAt: row.created_at
        };
        grouped[row.student_id] = [...(grouped[row.student_id] || []), report];
      });
      setStudentReports(grouped);
      setReportsError('');
    };
    loadReports();
    return () => { cancelled = true; };
  }, []);

  const visible = useMemo(() => students.filter(s =>
    (filter === 'همه' || s.type === filter) &&
    (s.name + s.field + s.phone + s.nationalId).toLowerCase().includes(query.toLowerCase())
  ), [students, filter, query]);
  const specialCount = students.filter(s => s.type === 'ویژه').length;
  const allPlans = students.flatMap(student =>
    student.type === 'ویژه' ? (plans[student.id] || []).map(plan => ({ ...plan, student })) : []
  );
  const allReports = students.flatMap(student =>
    (studentReports[student.id] || []).map(report => ({ ...report, student }))
  );
  const allReceipts = students.flatMap(student =>
    (receipts[student.id] || []).map(receipt => ({ ...receipt, student }))
  );
  const studentPlans = selectedStudent ? (plans[selectedStudent.id] || []) : [];
  const portalStudent = students.find(s=>s.id===portalStudentId) || students[0];
  const portalPlans = portalStudent ? (plans[portalStudent.id] || []) : [];
  const portalReports = portalStudent ? (studentReports[portalStudent.id] || []) : [];
  const portalReceipts = portalStudent ? (receipts[portalStudent.id] || []) : [];
  const submitStudentReport = e => {
    e.preventDefault();
    if (!portalStudent || portalStudent.type!=='ویژه') return;
    setStudentReports(prev=>({...prev,[portalStudent.id]:[{id:Date.now(),date:reportDate,items:reportItems,unread:reportUnread},...(prev[portalStudent.id]||[])]}));
    setReportDate(''); setReportItems([]); setReportUnread('ندارم');
    alert('گزارش در پیش‌نمایش ثبت شد؛ برای ذخیره دائمی از حساب واقعی دانش‌آموز استفاده کن.');
  };
  const addReportItem = () => setReportItems(prev=>[...prev,{id:Date.now()+Math.random(),subject:'',hours:'',tests:'',correct:'',wrong:'',unanswered:''}]);
  const submitReceipt = e => {
    e.preventDefault();
    if (!portalStudent || !receiptFile || !receiptAmount) return;
    const fileUrl = URL.createObjectURL(receiptFile);
    const item={id:Date.now(),fileName:receiptFile.name,fileType:receiptFile.type,fileUrl,preview:receiptFile.type.startsWith('image/')?fileUrl:null,amount:Number(receiptAmount),date:receiptDate,note:receiptNote,status:'در انتظار بررسی'};
    setReceipts(prev=>({...prev,[portalStudent.id]:[item,...(prev[portalStudent.id]||[])]}));
    setReceiptFile(null);setReceiptAmount('');setReceiptDate('');setReceiptNote('');
    alert('فیش به‌صورت آزمایشی ارسال شد و در انتظار بررسی است.');
  };

  const approveReceipt = (studentId, receiptId) => {
    const receipt = (receipts[studentId] || []).find(item => item.id === receiptId);
    if (!receipt || receipt.status === 'تأیید شد') return;
    setReceipts(prev => ({
      ...prev,
      [studentId]: (prev[studentId] || []).map(item =>
        item.id === receiptId ? {...item, status:'تأیید شد', reviewNote:''} : item
      )
    }));
    setFinance(prev => {
      const current = prev[studentId] || {contractAmount:'',planCount:'4',period:'یک ماه',start:'',end:'',payments:[]};
      if ((current.payments || []).some(payment => payment.receiptId === receiptId)) return prev;
      return {
        ...prev,
        [studentId]: {
          ...current,
          payments: [
            {id:Date.now(),receiptId,amount:Number(receipt.amount)||0,date:receipt.date,note:receipt.note || 'پرداخت تأییدشده از طریق فیش'},
            ...(current.payments || [])
          ]
        }
      };
    });
  };

  const rejectReceipt = (studentId, receiptId) => {
    const reason = window.prompt('دلیل رد فیش را وارد کن (اختیاری):') || '';
    setReceipts(prev => ({
      ...prev,
      [studentId]: (prev[studentId] || []).map(item =>
        item.id === receiptId ? {...item, status:'رد شد', reviewNote:reason} : item
      )
    }));
  };
  const studentFinance = selectedStudent ? (finance[selectedStudent.id] || {contractAmount:'', planCount:'4', period:'یک ماه', start:'', end:'', payments:[]}) : null;
  const paidTotal = studentFinance ? studentFinance.payments.reduce((sum,p)=>sum+(Number(p.amount)||0),0) : 0;
  const remaining = studentFinance && studentFinance.contractAmount!=='' ? Math.max(0, Number(studentFinance.contractAmount)-paidTotal) : null;
  const updateFinance = (field,value) => setFinance(prev=>({...prev,[selectedStudent.id]:{...(prev[selectedStudent.id]||{contractAmount:'',planCount:'4',period:'یک ماه',start:'',end:'',payments:[]}),[field]:value}}));
  const addPayment = e => {
    e.preventDefault();
    if (!paymentDraft.amount || Number(paymentDraft.amount)<=0) return;
    setFinance(prev=>{
      const current=prev[selectedStudent.id]||{contractAmount:'',planCount:'4',period:'یک ماه',start:'',end:'',payments:[]};
      return {...prev,[selectedStudent.id]:{...current,payments:[{id:Date.now(),amount:Number(paymentDraft.amount),date:paymentDraft.date,note:paymentDraft.note},...(current.payments||[])]}};
    });
    setPaymentDraft({amount:'',date:'',note:''});
  };

  const selectedContracts = selectedStudent ? (contractsByStudent[selectedStudent.id] || []) : [];
  const currentContract = selectedContracts[0] || null;

  const createContract = async e => {
    e.preventDefault();
    if (!selectedStudent || !contractDraft.amount || !contractDraft.startDate || !contractDraft.endDate) return;
    if (contractDraft.endDate < contractDraft.startDate) {
      setContractsError('تاریخ پایان نمی‌تواند قبل از تاریخ شروع باشد.');
      return;
    }
    setContractSaving(true);
    setContractsError('');
    const payload = {
      student_id: selectedStudent.id,
      amount: Number(contractDraft.amount),
      plan_count: contractDraft.planCount ? Number(contractDraft.planCount) : null,
      start_date: contractDraft.startDate,
      end_date: contractDraft.endDate,
      notes: contractDraft.notes.trim() || null,
      previous_contract_id: currentContract?.id || null
    };
    const { data, error } = await supabase
      .from('contracts')
      .insert(payload)
      .select('id,student_id,amount,plan_count,duration_days,start_date,end_date,notes,created_at,previous_contract_id')
      .single();
    setContractSaving(false);
    if (error) {
      setContractsError('ثبت قرارداد ناموفق بود: ' + error.message);
      return;
    }
    setContractsByStudent(prev => ({
      ...prev,
      [selectedStudent.id]: [data, ...(prev[selectedStudent.id] || [])]
    }));
    setContractDraft({amount:'', planCount:'4', startDate:'', endDate:'', notes:''});
    setShowContractForm(false);
  };

  const deleteContract = async contract => {
    const confirmed = window.confirm('این قرارداد حذف شود؟ این عملیات قابل بازگشت نیست.');
    if (!confirmed) return;
    setContractsError('');
    setContractsLoading(true);
    const children = selectedContracts.filter(item => item.previous_contract_id === contract.id);
    if (children.length) {
      const { error: relinkError } = await supabase
        .from('contracts')
        .update({ previous_contract_id: contract.previous_contract_id || null })
        .eq('previous_contract_id', contract.id);
      if (relinkError) {
        setContractsLoading(false);
        setContractsError('اصلاح ارتباط تمدیدها ناموفق بود: ' + relinkError.message);
        return;
      }
    }
    const { error } = await supabase.from('contracts').delete().eq('id', contract.id);
    if (error) {
      if (children.length) {
        await supabase.from('contracts')
          .update({ previous_contract_id: contract.id })
          .in('id', children.map(item => item.id));
      }
      setContractsLoading(false);
      setContractsError('حذف قرارداد ناموفق بود: ' + error.message);
      return;
    }
    setContractsByStudent(prev => ({
      ...prev,
      [selectedStudent.id]: (prev[selectedStudent.id] || [])
        .filter(item => item.id !== contract.id)
        .map(item => item.previous_contract_id === contract.id
          ? { ...item, previous_contract_id: contract.previous_contract_id || null }
          : item)
    }));
    setContractsLoading(false);
  };

  const getContractStatus = endDate => {
    if (!endDate) return {label:'تاریخ پایان ثبت نشده', tone:'normal'};
    const today = new Date();
    today.setHours(0,0,0,0);
    const end = new Date(`${endDate}T00:00:00`);
    const diff = Math.round((end - today) / 86400000);
    if (diff > 1) return {label:`${diff} روز تا پایان`, tone:'normal'};
    if (diff === 1) return {label:'یک روز تا پایان · هشدار تمدید', tone:'warning'};
    if (diff === 0) return {label:'امروز آخرین روز قرارداد', tone:'warning'};
    if (diff >= -3) return {label:`مهلت تمدید · ${Math.abs(diff)} روز از انقضا`, tone:'warning'};
    return {label:'مهلت تمدید تمام شده · نیازمند بررسی دسترسی', tone:'danger'};
  };

  const openAddStudent = () => {
    setEditingStudentId(null);
    setForm({name:'',field:'',grade:'دوازدهم',nationalId:'',phone:'',type:'عادی'});
    setStudentsError('');
    setShowModal(true);
  };
  const startEditStudent = student => {
    setEditingStudentId(student.id);
    setForm({name:student.name || '',field:student.field || '',grade:student.grade || 'دوازدهم',nationalId:student.nationalId || '',phone:student.phone || '',type:student.type || 'عادی'});
    setStudentsError('');
    setShowModal(true);
  };
  const addStudent = async e => {
    e.preventDefault();
    if (!form.name.trim() || !form.field) return;
    const nationalId = toEnglishDigits(form.nationalId).replace(/\D/g, '');
    const phone = toEnglishDigits(form.phone).replace(/\D/g, '');
    if (!/^\d{10}$/.test(nationalId)) {
      setStudentsError('کد ملی باید دقیقاً ۱۰ رقم باشد.');
      return;
    }
    if (!/^09\d{9}$/.test(phone)) {
      setStudentsError('شماره همراه باید با 09 شروع شود و ۱۱ رقم باشد.');
      return;
    }
    setStudentsError('');
    const payload = {
      full_name: form.name.trim(),
      field: form.field,
      grade: form.grade || null,
      national_id: nationalId,
      phone,
      student_type: form.type === 'ویژه' ? 'special' : 'ordinary'
    };
    const result = editingStudentId
      ? await supabase.from('students').update(payload).eq('id', editingStudentId).select('id,user_id,full_name,field,student_type,national_id,phone,notes,grade').single()
      : await supabase.from('students').insert(payload).select('id,user_id,full_name,field,student_type,national_id,phone,notes,grade').single();
    if (result.error) {
      setStudentsError('ذخیره دانش‌آموز ناموفق بود: ' + result.error.message);
      return;
    }
    const row = result.data;
    const { data: accountResult, error: accountError } = await supabase.functions.invoke('create-student-account', {
      body: { student_id: row.id }
    });
    if (accountError || accountResult?.error) {
      setStudentsError('اطلاعات دانش‌آموز ذخیره شد، اما ساخت/به‌روزرسانی حساب ورود انجام نشد: ' + (accountResult?.error || accountError?.message || 'خطای نامشخص') + '؛ دوباره پرونده را ویرایش و ذخیره کن.');
      return;
    }
    const saved = {id:row.id,userId:accountResult?.user_id || row.user_id,name:row.full_name,field:row.field,grade:row.grade || '—',nationalId:row.national_id || '',phone:row.phone || '',notes:row.notes || '',type:row.student_type === 'special' ? 'ویژه' : 'عادی'};
    setStudents(prev => editingStudentId ? prev.map(item => item.id === editingStudentId ? saved : item) : [saved, ...prev]);
    setSelectedStudent(prev => prev?.id === saved.id ? saved : prev);
    setForm({name:'',field:'',grade:'دوازدهم',nationalId:'',phone:'',type:'عادی'});
    setEditingStudentId(null);
    setShowModal(false);
  };
  const toggleType = async id => {
    const current = students.find(student => student.id === id);
    if (!current) return;
    const nextType = current.type === 'ویژه' ? 'ordinary' : 'special';
    const { data, error } = await supabase.from('students').update({student_type:nextType}).eq('id',id).select('id').single();
    if (error) {
      alert('تغییر نوع دانش‌آموز ذخیره نشد: ' + error.message);
      return;
    }
    const displayType = nextType === 'special' ? 'ویژه' : 'عادی';
    setStudents(prev => prev.map(student => student.id === id ? {...student,type:displayType} : student));
    setSelectedStudent(prev => prev?.id === id ? {...prev,type:displayType} : prev);
  };
  const deleteStudent = async id => {
    const student = students.find(item => item.id === id);
    if (!student || !window.confirm(`دانش‌آموز «${student.name}» حذف شود؟ این کار قابل بازگشت نیست.`)) return;
    const { error } = await supabase.from('students').delete().eq('id',id);
    if (error) {
      alert('حذف دانش‌آموز ناموفق بود: ' + error.message);
      return;
    }
    setStudents(prev => prev.filter(item => item.id !== id));
    setSelectedStudent(prev => prev?.id === id ? null : prev);
  };
  const openProfile = s => { setSelectedStudent(s); setProfileTab('overview'); setEditingPlan(false); };
  const updateLesson = (day, blockId, lessonId, field, value) => setPlanDays(prev => prev.map(d => d.day!==day ? d : ({...d,blocks:d.blocks.map(b => b.id!==blockId ? b : ({...b,lessons:b.lessons.map(l=>l.id!==lessonId?l:{...l,[field]:value})}))})));
  const addLesson = (day, blockId) => setPlanDays(prev => prev.map(d => d.day!==day ? d : ({...d,blocks:d.blocks.map(b => b.id!==blockId?b:{...b,lessons:[...b.lessons,{id:Date.now()+Math.random(),subject:'',topic:'',duration:'۱ ساعت',durationOther:'',activity:['مطالعه']}]})})));
  const removeLesson = (day, blockId, lessonId) => setPlanDays(prev => prev.map(d => d.day!==day ? d : ({...d,blocks:d.blocks.map(b => b.id!==blockId?b:{...b,lessons:b.lessons.filter(l=>l.id!==lessonId)})})));
  const startNewPlan = () => {
    setEditingPlanId(null);
    setPlanDays(blankPlan());
    setPlanStart('');
    setPlanEnd('');
    setPlanTitle('برنامه هفتگی');
    setActiveDay('شنبه');
    setPlansError('');
    setEditingPlan(true);
  };
  const startEditPlan = plan => {
    if (!selectedStudent || selectedStudent.type !== 'ویژه') return;
    setEditingPlanId(plan.id);
    setPlanDays(Array.isArray(plan.days) && plan.days.length ? plan.days : blankPlan());
    setPlanStart(plan.start || '');
    setPlanEnd(plan.end || '');
    setPlanTitle(plan.title || 'برنامه هفتگی');
    setActiveDay('شنبه');
    setPlansError('');
    setViewingPlan(null);
    setEditingPlan(true);
  };
  const savePlan = async () => {
    if (!selectedStudent || selectedStudent.type !== 'ویژه') return;
    if (!planTitle.trim()) {
      setPlansError('برای برنامه یک عنوان وارد کن.');
      return;
    }
    if (!planStart || !planEnd) {
      setPlansError('تاریخ شروع و پایان برنامه را انتخاب کن.');
      return;
    }
    if (planEnd < planStart) {
      setPlansError('تاریخ پایان نمی‌تواند قبل از تاریخ شروع باشد.');
      return;
    }
    setPlansLoading(true);
    setPlansError('');
    const payload = {
      student_id: selectedStudent.id,
      title: planTitle.trim(),
      start_date: planStart,
      end_date: planEnd,
      days: planDays
    };
    const result = editingPlanId
      ? await supabase.from('weekly_plans').update(payload).eq('id', editingPlanId).select('id,student_id,title,start_date,end_date,days').single()
      : await supabase.from('weekly_plans').insert(payload).select('id,student_id,title,start_date,end_date,days').single();
    setPlansLoading(false);
    if (result.error) {
      setPlansError('ذخیره برنامه ناموفق بود: ' + result.error.message);
      return;
    }
    const row = result.data;
    const savedPlan = { id: row.id, title: row.title, start: row.start_date || '', end: row.end_date || '', days: Array.isArray(row.days) ? row.days : [] };
    setPlans(prev => ({
      ...prev,
      [selectedStudent.id]: editingPlanId
        ? (prev[selectedStudent.id] || []).map(item => item.id === editingPlanId ? savedPlan : item)
        : [savedPlan, ...(prev[selectedStudent.id] || [])]
    }));
    setEditingPlanId(null);
    setEditingPlan(false);
    setViewingPlan(null);
    setProfileTab('plans');
  };
  const deletePlan = async plan => {
    if (!selectedStudent || selectedStudent.type !== 'ویژه') return;
    if (!window.confirm(`برنامه «${plan.title}» حذف شود؟ این عملیات قابل بازگشت نیست.`)) return;
    setPlansLoading(true);
    setPlansError('');
    const { error } = await supabase.from('weekly_plans').delete().eq('id', plan.id);
    setPlansLoading(false);
    if (error) {
      setPlansError('حذف برنامه ناموفق بود: ' + error.message);
      return;
    }
    setPlans(prev => ({ ...prev, [selectedStudent.id]: (prev[selectedStudent.id] || []).filter(item => item.id !== plan.id) }));
    if (viewingPlan?.id === plan.id) setViewingPlan(null);
  };

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark"><GraduationCap size={23}/></div><div><b>EduPanel</b><small>مدیریت آموزشی</small></div></div>
      <div className="side-label">منوی اصلی</div>
      {[[LayoutDashboard,'داشبورد'],[Users,'دانش‌آموزان'],[CalendarDays,'برنامه هفتگی'],[ClipboardList,'گزارش‌های روزانه'],[FileText,'فیش‌های پرداخت']].map(([Icon,label])=><button key={label} className={`nav-item ${active===label&&!selectedStudent?'active':''}`} onClick={()=>{setActive(label);setSelectedStudent(null);}}><Icon size={18}/><span>{label}</span>{label==='دانش‌آموزان'&&<small>{students.length}</small>}{label==='فیش‌های پرداخت'&&allReceipts.filter(r=>r.status==='در انتظار بررسی').length>0&&<small>{allReceipts.filter(r=>r.status==='در انتظار بررسی').length}</small>}</button>)}
      <div className="side-bottom"><button className="nav-item" onClick={()=>{setActive('تنظیمات');setSelectedStudent(null)}}><Settings size={18}/><span>تنظیمات</span></button><div className="profile"><div className="avatar">م</div><div><b>{profile?.full_name || profile?.email || "مدیر پنل"}</b><small>حساب مدیریت</small></div><MoreHorizontal size={18}/></div></div>
    </aside>
    <main className="main">
      <header className="topbar"><div><span className="eyebrow">پنل مدیریت</span><h1>{selectedStudent?'پرونده دانش‌آموز':active}</h1></div><div className="top-actions"><button className="secondary-btn" onClick={onSignOut}>خروج از حساب</button><span className="today">{profile?.email || "پنل مدیریت آموزشی"}</span><div className="avatar">م</div></div></header>

      {portalMode ? <section className="portal-wrap">
        <div className="portal-banner"><div><span className="welcome-tag">پنل دانش‌آموزی · پیش‌نمایش</span><h2>سلام {portalStudent?.name||'دانش‌آموز'} 👋</h2><p>برنامه‌ها، گزارش‌های روزانه و وضعیت پرداختت را از اینجا پیگیری کن.</p></div><div className="portal-student-select"><label>نمایش حساب آزمایشی<select value={portalStudentId} onChange={e=>setPortalStudentId(Number(e.target.value))}>{students.map(s=><option key={s.id} value={s.id}>{s.name} · {s.type}</option>)}</select></label></div></div>
        {portalStudent?.type==='ویژه' ? <>
          <div className="profile-tabs portal-tabs"><button className="active"><CalendarDays size={16}/> برنامه‌های من</button><button onClick={()=>document.getElementById('report-form')?.scrollIntoView({behavior:'smooth'})}><ClipboardList size={16}/> ارسال گزارش</button><button onClick={()=>document.getElementById('receipt-form')?.scrollIntoView({behavior:'smooth'})}><FileText size={16}/> ارسال فیش</button></div>
          <section className="panel"><div className="panel-head"><div><h3>برنامه‌های هفتگی من</h3><p>برنامه‌هایی که مدیر برایت ثبت کرده است.</p></div></div>{portalPlans.length===0?<div className="empty-panel"><div className="empty-icon"><CalendarDays size={25}/></div><h3>هنوز برنامه‌ای ثبت نشده</h3></div>:portalPlans.map(pl=><details className="portal-plan" key={pl.id}><summary><b>{pl.title}</b><span>{pl.start ? formatJalaliDate(pl.start) : '—'} تا {pl.end ? formatJalaliDate(pl.end) : '—'}</span></summary>{pl.days.map(d=><div className="portal-day" key={d.day}><b>{d.day}</b><div>{d.blocks.map(b=><div className="portal-block" key={b.id}><strong>{b.title} · {b.time}</strong>{b.lessons.map(l=><p key={l.id}>{l.subject} — {l.topic} — {formatDuration(l)} ({formatActivity(l.activity)})</p>)}</div>)}</div></div>)}</details>)}</section>
          <section className="portal-two-col">
            <form id="report-form" className="panel" onSubmit={submitStudentReport}><div className="panel-head"><div><h3>ارسال گزارش روزانه</h3><p>درس‌های برنامه همان روز را می‌توانی در گزارش وارد کنی.</p></div></div><JalaliDatePicker label="تاریخ گزارش" required value={reportDate} onChange={setReportDate}/><div className="report-item-list">{reportItems.map((it,i)=><div className="report-edit-card" key={it.id}><div className="lesson-card-head"><b>فعالیت {i+1}</b><button type="button" className="icon-danger" onClick={()=>setReportItems(prev=>prev.filter(x=>x.id!==it.id))}><Trash2 size={14}/></button></div><div className="lesson-fields">{[['subject','نام درس'],['hours','ساعت مطالعه'],['tests','تعداد تست'],['correct','درست'],['wrong','غلط'],['unanswered','نزده']].map(([k,l])=><label key={k}>{l}<input value={it[k]} onChange={e=>setReportItems(prev=>prev.map(x=>x.id===it.id?{...x,[k]:e.target.value}:x))}/></label>)}</div></div>)}</div><button type="button" className="secondary-btn" onClick={addReportItem}><Plus size={15}/> افزودن فعالیت</button><label className="portal-label">درس‌های خوانده‌نشده<input value={reportUnread} onChange={e=>setReportUnread(e.target.value)} /></label><button className="primary-btn" type="submit">ثبت گزارش روزانه</button><div className="hint">نسخه فعلی آزمایشی است؛ اتصال خودکار درس‌های برنامه در مرحله تکمیل گزارش انجام می‌شود.</div></form>
            <div className="portal-side-stack"><form id="receipt-form" className="panel" onSubmit={submitReceipt}><h3>ارسال فیش پرداخت</h3><p className="panel-sub">عکس فیش یا فایل PDF پرداخت را ارسال کن.</p><label className="portal-label">مبلغ پرداختی (تومان)<input required type="number" min="1" value={receiptAmount} onChange={e=>setReceiptAmount(e.target.value)} placeholder="مثلاً ۵۰۰۰۰۰"/></label><label className="portal-label">تاریخ پرداخت<input value={receiptDate} onChange={e=>setReceiptDate(e.target.value)} placeholder="۱۴۰۵/۰۹/۰۱"/></label><label className="portal-label">انتخاب فیش<input required type="file" accept="image/jpeg,image/png,application/pdf" onChange={e=>setReceiptFile(e.target.files?.[0]||null)}/></label>{receiptFile&&<div className="file-picked"><FileText size={17}/><span>{receiptFile.name}</span></div>}<label className="portal-label">توضیحات (اختیاری)<input value={receiptNote} onChange={e=>setReceiptNote(e.target.value)} placeholder="مثلاً بابت برنامه آذر"/></label><button className="primary-btn" type="submit">ارسال فیش برای مدیر</button></form><section className="panel"><h3>سوابق فیش‌های ارسالی</h3>{portalReceipts.length===0?<p className="hint">هنوز فیشی ارسال نکرده‌ای.</p>:portalReceipts.map(r=><div className="payment-row" key={r.id}><div><b>{r.amount.toLocaleString('fa-IR')} تومان</b><small>{r.date||'بدون تاریخ'} · {r.fileName}</small></div><span className="pill special">{r.status}</span></div>)}</section><section className="panel"><h3>گزارش‌های قبلی</h3>{portalReports.length===0?<p className="hint">هنوز گزارشی ثبت نکرده‌ای.</p>:portalReports.map(r=><div className="payment-row" key={r.id}><div><b>{r.date}</b><small>{r.items.length} فعالیت ثبت‌شده</small></div><span className="pill normal">ثبت‌شده</span></div>)}</section></div>
          </section>
        </> : <section className="panel empty-panel"><div className="empty-icon"><UserRound size={25}/></div><h3>حساب دانش‌آموز عادی</h3><p>در این حساب برنامه اختصاصی و ارسال گزارش روزانه فعال نیست.</p><p>برای امور مربوط به پرداخت، با مدیر مجموعه هماهنگ کن.</p></section>}
      </section> : selectedStudent ? <>
        <button className="back-link" onClick={()=>setSelectedStudent(null)}><ArrowRight size={16}/> بازگشت به فهرست دانش‌آموزان</button>
        <section className="student-hero"><div className="student-avatar big">{selectedStudent.name.slice(0,1)}</div><div className="student-hero-info"><div className="name-line"><h2>{selectedStudent.name}</h2><span className={`pill ${selectedStudent.type==='ویژه'?'special':'normal'}`}>{selectedStudent.type==='ویژه'&&<Star size={12}/ >}{selectedStudent.type}</span></div><p>{selectedStudent.field||'رشته ثبت نشده'} <span>·</span> پایه {selectedStudent.grade}</p><small>{selectedStudent.phone||'شماره تماس ثبت نشده'}</small></div><button className="secondary-btn change-type" onClick={()=>toggleType(selectedStudent.id)}>تبدیل به {selectedStudent.type==='ویژه'?'عادی':'ویژه'}</button></section>
        <div className="profile-tabs"><button className={profileTab==='overview'?'active':''} onClick={()=>setProfileTab('overview')}><UserRound size={16}/> نمای کلی</button>{selectedStudent.type==='ویژه'&&<button className={profileTab==='plans'?'active':''} onClick={()=>setProfileTab('plans')}><CalendarDays size={16}/> برنامه‌های هفتگی</button>}{selectedStudent.type==='ویژه'&&<button className={profileTab==='finance'?'active':''} onClick={()=>setProfileTab('finance')}><FileText size={16}/> امور مالی</button>}{selectedStudent.type==='ویژه'&&<button className={profileTab==='reports'?'active':''} onClick={()=>setProfileTab('reports')}><ClipboardList size={16}/> گزارش‌های روزانه</button>}</div>
        {profileTab==='overview'&&<section className="profile-grid"><div className="panel info-panel"><h3>اطلاعات دانش‌آموز</h3><div className="info-grid"><Info label="نام و نام خانوادگی" value={selectedStudent.name}/><Info label="رشته تحصیلی" value={selectedStudent.field||'ثبت نشده'}/><Info label="پایه تحصیلی" value={selectedStudent.grade}/><Info label="کد ملی" value={selectedStudent.nationalId||'ثبت نشده'}/><Info label="شماره تماس" value={selectedStudent.phone||'ثبت نشده'}/><Info label="نوع عضویت" value={selectedStudent.type}/></div></div><div className="panel quick-panel"><h3>وضعیت آموزشی</h3><div className="quick-row"><div className="stat-icon blue"><CalendarCheck size={19}/></div><div><b>{selectedStudent.type==='ویژه'?'برنامه اختصاصی':'بدون برنامه اختصاصی'}</b><small>{selectedStudent.type==='ویژه'?'امکان تعریف برنامه هفتگی برای این دانش‌آموز وجود دارد':'دانش‌آموز عادی برنامه اختصاصی و گزارش روزانه ندارد.'}</small></div></div>{selectedStudent.type==='ویژه'?<div className="quick-row"><div className="stat-icon violet"><FileText size={19}/></div><div><b>گزارش‌های روزانه</b><small>این دانش‌آموز می‌تواند گزارش کار ارسال کند.</small></div></div>:<div className="notice">برای دانش‌آموزان عادی، ارسال گزارش کار غیرفعال است.</div>}</div></section>}
        {profileTab==='plans'&&!editingPlan&&!viewingPlan&&<section className="panel archive-panel"><div className="panel-head"><div><h3>آرشیو برنامه‌های هفتگی</h3><p>برنامه‌های قبلی این دانش‌آموز در این قسمت نگهداری می‌شوند.</p></div>{selectedStudent.type==='ویژه'&&<button className="primary-btn" onClick={startNewPlan}><Plus size={17}/> ساخت برنامه جدید</button>}</div>{plansLoading&&<p className="hint">در حال دریافت یا ذخیره برنامه‌ها…</p>}{plansError&&<p className="student-data-error">{plansError}</p>}{selectedStudent.type!=='ویژه'?<div className="empty-panel"><div className="empty-icon"><CalendarDays size={25}/></div><h3>برنامه اختصاصی فعال نیست</h3><p>ساخت برنامه هفتگی فقط برای دانش‌آموزان ویژه امکان‌پذیر است.</p></div>:studentPlans.length===0?<div className="empty-panel"><div className="empty-icon"><CalendarDays size={25}/></div><h3>هنوز برنامه‌ای ثبت نشده</h3><p>برای شروع، برنامه هفتگی این دانش‌آموز را بساز.</p></div>:<div className="plan-list">{studentPlans.map(p=><div className="plan-row" key={p.id}><div className="plan-row-icon"><CalendarDays size={20}/></div><div className="plan-row-info"><b>{p.title}</b><small>{p.start ? formatJalaliDate(p.start) : 'تاریخ شروع نامشخص'} تا {p.end ? formatJalaliDate(p.end) : 'تاریخ پایان نامشخص'}</small></div><div className="plan-row-actions"><span className="pill normal">ذخیره‌شده</span><button className="secondary-btn" onClick={()=>setViewingPlan(p)}>مشاهده</button><button className="secondary-btn" onClick={()=>startEditPlan(p)}>ویرایش</button><button className="contract-delete-btn" onClick={()=>deletePlan(p)} disabled={plansLoading}><Trash2 size={13}/> حذف</button></div></div>)}</div>}</section>}
        {profileTab==='plans'&&viewingPlan&&<section className="panel planner"><div className="panel-head"><div><h3>{viewingPlan.title}</h3><p>{viewingPlan.start ? formatJalaliDate(viewingPlan.start) : 'تاریخ شروع نامشخص'} تا {viewingPlan.end ? formatJalaliDate(viewingPlan.end) : 'تاریخ پایان نامشخص'}</p></div><div className="contract-history-actions"><button className="secondary-btn" onClick={()=>startEditPlan(viewingPlan)}>ویرایش برنامه</button><button className="secondary-btn" onClick={()=>setViewingPlan(null)}>بازگشت به آرشیو</button></div></div><div className="saved-plan-view">{viewingPlan.days.map(d=><div className="saved-day" key={d.day}><h4>{d.day}</h4><div className="saved-blocks">{d.blocks.map(b=><div className="saved-block" key={b.id}><b>{b.title}</b><small>{b.time}</small>{b.lessons.length===0?<p className="hint">درسی ثبت نشده</p>:b.lessons.map((l,i)=><div className="saved-lesson" key={l.id}><strong>{i+1}. {l.subject||'بدون نام'}</strong><span>{l.topic||'بدون مبحث'}</span><span>{formatDuration(l)} · {formatActivity(l.activity)}</span></div>)}</div>)}</div></div>)}</div></section>}
        {profileTab==='finance'&&selectedStudent.type==='ویژه'&&<section className="panel contracts-panel">
          <div className="panel-head">
            <div><h3>قراردادهای دانش‌آموز</h3><p>هر تمدید به‌عنوان قرارداد جدید ثبت می‌شود و سوابق قبلی باقی می‌مانند.</p></div>
            <button className="primary-btn" onClick={()=>{setContractsError('');setContractDraft({amount:'',planCount:'4',startDate:'',endDate:'',notes:''});setShowContractForm(v=>!v)}}><Plus size={16}/> قرارداد جدید</button>
          </div>
          {contractsLoading&&<p className="hint">در حال دریافت سوابق قرارداد…</p>}
          {contractsError&&<div className="student-data-error">{contractsError}</div>}
          {currentContract&&(()=>{
            const status=getContractStatus(currentContract.end_date);
            return <div className="current-contract-card">
              <div className="current-contract-head"><b>آخرین قرارداد ثبت‌شده</b><span className={`contract-status ${status.tone}`}>{status.label}</span></div>
              <div className="contract-facts">
                <div><small>مبلغ قرارداد</small><b>{Number(currentContract.amount).toLocaleString('fa-IR')} تومان</b></div>
                <div><small>تعداد برنامه</small><b>{currentContract.plan_count ?? '—'}</b></div>
                <div><small>شروع</small><b>{formatJalaliDate(currentContract.start_date)}</b></div>
                <div><small>پایان</small><b>{formatJalaliDate(currentContract.end_date)}</b></div>
              </div>
              {currentContract.notes&&<p className="contract-note">{currentContract.notes}</p>}
            </div>;
          })()}
          {showContractForm&&<form className="contract-form" onSubmit={createContract}>
            <h4>{currentContract?'ثبت تمدید / قرارداد جدید':'ثبت اولین قرارداد'}</h4>
            {currentContract&&<p className="hint">این قرارداد به‌عنوان سابقه جدید به قرارداد قبلی متصل می‌شود؛ اطلاعات قرارداد قبلی تغییر نمی‌کند.</p>}
            <div className="contract-form-grid">
              <label>مبلغ قرارداد (تومان)<input required type="number" min="1" step="1" value={contractDraft.amount} onChange={e=>setContractDraft({...contractDraft,amount:e.target.value})} placeholder="مثلاً ۹۰۰۰۰۰"/></label>
              <label>تعداد برنامه<input type="number" min="1" value={contractDraft.planCount} onChange={e=>setContractDraft({...contractDraft,planCount:e.target.value})} placeholder="مثلاً ۴"/></label>
              <JalaliDatePicker label="تاریخ شروع" required value={contractDraft.startDate} onChange={value=>setContractDraft({...contractDraft,startDate:value})}/>
              <JalaliDatePicker label="تاریخ پایان" required value={contractDraft.endDate} onChange={value=>setContractDraft({...contractDraft,endDate:value})}/>
            </div>
            <label className="contract-notes-label">توضیحات (اختیاری)<textarea rows="2" value={contractDraft.notes} onChange={e=>setContractDraft({...contractDraft,notes:e.target.value})} placeholder="توضیحات قرارداد"/></label>
            <div className="modal-actions"><button type="button" className="secondary-btn" onClick={()=>setShowContractForm(false)}>انصراف</button><button className="primary-btn" type="submit" disabled={contractSaving}>{contractSaving?'در حال ذخیره…':'ثبت قرارداد در دیتابیس'}</button></div>
          </form>}
          <div className="contract-history-head"><h4>تاریخچه قراردادها</h4><span className="hint">{selectedContracts.length} قرارداد</span></div>
          {selectedContracts.length===0?<div className="empty-panel"><div className="empty-icon"><FileText size={24}/></div><h3>هنوز قراردادی ثبت نشده</h3><p>برای شروع، اولین قرارداد این دانش‌آموز را ثبت کن.</p></div>:<div className="contract-history-list">
            {selectedContracts.map((contract,index)=>{
              const status=getContractStatus(contract.end_date);
              return <div className="contract-history-row" key={contract.id}>
                <div className="contract-history-top"><b>قرارداد {selectedContracts.length-index}</b><div className="contract-history-actions"><span className={`contract-status ${status.tone}`}>{status.label}</span><button type="button" className="contract-delete-btn" onClick={()=>deleteContract(contract)} disabled={contractsLoading} title="حذف قرارداد"><Trash2 size={14}/> حذف</button></div></div>
                <div className="contract-facts">
                  <div><small>مبلغ</small><b>{Number(contract.amount).toLocaleString('fa-IR')} تومان</b></div>
                  <div><small>تعداد برنامه</small><b>{contract.plan_count ?? '—'}</b></div>
                  <div><small>شروع</small><b>{formatJalaliDate(contract.start_date)}</b></div>
                  <div><small>پایان</small><b>{formatJalaliDate(contract.end_date)}</b></div>
                </div>
                {contract.notes&&<p className="contract-note">{contract.notes}</p>}
                {contract.previous_contract_id&&<small className="contract-linked">مرتبط با قرارداد قبلی</small>}
              </div>;
            })}
          </div>}
          <p className="hint contract-footnote">وضعیت‌ها بر اساس تاریخ پایان محاسبه می‌شوند. قطع دسترسی واقعی پس از اتصال حساب دانش‌آموز به پرونده او در مرحله پنل دانش‌آموز اعمال خواهد شد.</p>
        </section>}
        {profileTab==='plans'&&editingPlan&&<section className="panel planner"><div className="panel-head"><div><h3>{editingPlanId ? 'ویرایش برنامه هفتگی' : 'ساخت برنامه هفتگی'}</h3><p>برای هر روز و هر بازه، هر تعداد کارت درسی لازم داری اضافه کن.</p></div><button className="secondary-btn" onClick={()=>setEditingPlan(false)}>انصراف</button></div><div className="plan-meta"><label>عنوان برنامه<input value={planTitle} onChange={e=>setPlanTitle(e.target.value)} placeholder="مثلاً برنامه هفته اول"/></label><JalaliDatePicker label="تاریخ شروع *" value={planStart} onChange={setPlanStart} required/><JalaliDatePicker label="تاریخ پایان *" value={planEnd} onChange={setPlanEnd} required/></div><div className="day-tabs">{days.map(d=><button key={d} className={activeDay===d?'active':''} onClick={()=>setActiveDay(d)}>{d}</button>)}</div><div className="blocks-grid">{(planDays.find(d=>d.day===activeDay)?.blocks||[]).map(b=><div className="block-card" key={b.id}><div className="block-head"><div><b>{b.title}</b><small>{b.time}</small></div><button className="add-small" onClick={()=>addLesson(activeDay,b.id)}><Plus size={15}/> افزودن درس</button></div>{b.lessons.length===0&&<div className="no-lessons">هنوز درسی در این بازه ثبت نشده.</div>}{b.lessons.map((l,i)=><div className="lesson-card" key={l.id}><div className="lesson-card-head"><b>کارت درس {i+1}</b><button className="icon-danger" onClick={()=>removeLesson(activeDay,b.id,l.id)} title="حذف کارت"><Trash2 size={15}/></button></div><div className="lesson-fields"><label>نام درس<input value={l.subject} onChange={e=>updateLesson(activeDay,b.id,l.id,'subject',e.target.value)} placeholder="مثلاً ریاضی"/></label><label>مبحث / صفحات<input value={l.topic} onChange={e=>updateLesson(activeDay,b.id,l.id,'topic',e.target.value)} placeholder="مثلاً فصل دوم، صفحه ۲۰ تا ۳۵"/></label><label>مدت مطالعه<select value={l.duration || '۱ ساعت'} onChange={e=>updateLesson(activeDay,b.id,l.id,'duration',e.target.value)}><option>۳۰ دقیقه</option><option>۴۵ دقیقه</option><option>۱ ساعت</option><option>۱ ساعت و ۳۰ دقیقه</option><option>۲ ساعت</option><option>۳ ساعت</option><option>غیره</option></select>{l.duration==='غیره'&&<input className="duration-other-input" value={l.durationOther||''} onChange={e=>updateLesson(activeDay,b.id,l.id,'durationOther',e.target.value)} placeholder="مدت دلخواه را بنویس"/>}</label><div className="lesson-activity-field"><span className="lesson-field-label">نوع فعالیت (چند انتخابی)</span><div className="activity-options">{activityOptions.map(option=><button type="button" key={option} className={(Array.isArray(l.activity)?l.activity:[l.activity]).includes(option)?'active':''} onClick={()=>{const current=Array.isArray(l.activity)?l.activity:(l.activity?[l.activity]:[]);const next=current.includes(option)?current.filter(x=>x!==option):[...current,option];updateLesson(activeDay,b.id,l.id,'activity',next);}}>{option}</button>)}</div></div></div></div>)}</div>)}</div><div className="planner-footer"><div><span className="hint">می‌تونی تعداد کارت‌های هر بازه رو مستقل تنظیم کنی.</span>{plansError&&<p className="student-data-error">{plansError}</p>}</div><button className="primary-btn" onClick={savePlan} disabled={plansLoading}><Save size={17}/> {plansLoading ? 'در حال ذخیره…' : editingPlanId ? 'ذخیره تغییرات' : 'ذخیره برنامه هفتگی'}</button></div></section>}
        {profileTab==='reports'&&selectedStudent.type==='ویژه'&&<section className="panel archive-panel"><div className="panel-head"><div><h3>گزارش‌های روزانه {selectedStudent.name}</h3><p>گزارش‌هایی که از حساب دانش‌آموز ارسال شده‌اند.</p></div><span className="pill normal">{studentReports[selectedStudent.id]?.length || 0} گزارش</span></div>{reportsError&&<p className="student-data-error">{reportsError}</p>}{(studentReports[selectedStudent.id]||[]).length===0?<div className="empty-panel"><div className="empty-icon"><ClipboardList size={25}/></div><h3>هنوز گزارشی ارسال نشده</h3><p>بعد از ثبت گزارش توسط دانش‌آموز، جزئیات آن اینجا نمایش داده می‌شود.</p></div>:<div className="plan-list">{(studentReports[selectedStudent.id]||[]).map(report=><article className="panel" key={report.id} style={{marginBottom:12}}><div className="panel-head"><div><h3>گزارش {formatJalaliDate(report.date)}</h3><p>{report.items.length} فعالیت ثبت‌شده</p></div><span className="pill normal">ثبت‌شده</span></div><div className="table-wrap"><table><thead><tr><th>درس</th><th>ساعت مطالعه</th><th>تست</th><th>درست</th><th>غلط</th><th>نزده</th></tr></thead><tbody>{report.items.map((item,index)=><tr key={item.id || index}><td>{item.subject || '—'}</td><td>{item.hours || '—'}</td><td>{item.tests || '—'}</td><td>{item.correct || '—'}</td><td>{item.wrong || '—'}</td><td>{item.unanswered || '—'}</td></tr>)}</tbody></table></div><p className="hint">درس‌های خوانده‌نشده: {report.unread || 'ندارد'}</p><small className="hint">زمان ارسال: {report.createdAt ? new Date(report.createdAt).toLocaleString('fa-IR') : '—'}</small></article>)}</div>}</section>}
      </>: active==='داشبورد' ? <>
        <section className="welcome"><div><span className="welcome-tag">نمای کلی مجموعه</span><h2>خوش اومدی 👋</h2><p>وضعیت دانش‌آموزها و برنامه‌های آموزشی رو از اینجا مدیریت کن.</p></div><div className="welcome-icon"><GraduationCap size={46}/></div></section>
        <section className="stats"><Stat icon={<Users size={20}/>} label="کل دانش‌آموزان" value={students.length} note="در فهرست شما" color="blue"/><Stat icon={<Star size={20}/>} label="دانش‌آموزان ویژه" value={specialCount} note="دارای برنامه اختصاصی" color="amber"/><Stat icon={<BookOpen size={20}/>} label="دانش‌آموزان عادی" value={students.length-specialCount} note="بدون برنامه و گزارش کار" color="green"/><Stat icon={<ClipboardList size={20}/>} label="کل گزارش‌های ثبت‌شده" value={allReports.length} note="گزارش‌های ذخیره‌شده" color="violet"/></section>
        <section className="panel"><div className="panel-head"><div><h3>دسترسی سریع به دانش‌آموزان</h3><p>برای مشاهده پرونده هر دانش‌آموز روی نام او کلیک کن.</p></div><button className="primary-btn" onClick={()=>{setActive('دانش‌آموزان');openAddStudent()}}><Plus size={18}/> افزودن دانش‌آموز</button></div><div className="table-wrap"><table><thead><tr><th>دانش‌آموز</th><th>رشته تحصیلی</th><th>نوع عضویت</th><th>عملیات</th></tr></thead><tbody>{students.slice(0,5).map(s=><tr key={s.id}><td><button className="student-open" onClick={()=>openProfile(s)}><span className="student-avatar">{s.name.slice(0,1)}</span><b>{s.name}</b></button></td><td>{s.field||'—'}</td><td><span className={`pill ${s.type==='ویژه'?'special':'normal'}`}>{s.type}</span></td><td><button className="text-action" onClick={()=>openProfile(s)}>مشاهده پرونده</button></td></tr>)}</tbody></table></div></section>
      </> : active==='دانش‌آموزان' ? <>
        <section className="panel"><div className="panel-head"><div><h3>فهرست دانش‌آموزان</h3><p>جست‌وجو، فیلتر و مدیریت پرونده دانش‌آموزها.</p></div><button className="primary-btn" onClick={openAddStudent}><Plus size={18}/> افزودن دانش‌آموز</button></div><div className="toolbar"><div className="search"><Search size={18}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="جست‌وجوی نام، رشته یا شماره..."/></div><div className="filters">{['همه','ویژه','عادی'].map(f=><button key={f} className={filter===f?'selected':''} onClick={()=>setFilter(f)}>{f}</button>)}</div></div><div className="student-data-status">{studentsLoading&&<span>در حال دریافت فهرست دانش‌آموزان…</span>}{studentsError&&<span className="student-data-error">{studentsError}</span>}</div><div className="table-wrap"><table><thead><tr><th>دانش‌آموز</th><th>رشته تحصیلی</th><th>پایه</th><th>کد ملی</th><th>شماره تماس</th><th>نوع عضویت</th><th>عملیات</th></tr></thead><tbody>{visible.map(s=><tr key={s.id}><td><button className="student-open" onClick={()=>openProfile(s)}><span className="student-avatar">{s.name.slice(0,1)}</span><b>{s.name}</b><ChevronLeft size={14}/></button></td><td>{s.field||'—'}</td><td>{s.grade}</td><td className="phone">{s.nationalId||'—'}</td><td className="phone">{s.phone||'—'}</td><td><span className={`pill ${s.type==='ویژه'?'special':'normal'}`}>{s.type==='ویژه'&&<Star size={12}/ >}{s.type}</span></td><td><div className="student-row-actions"><button className="text-action" onClick={()=>startEditStudent(s)}>ویرایش</button><button className="text-action" onClick={()=>toggleType(s.id)}>{s.type==='ویژه'?'تبدیل به عادی':'ویژه کردن'}</button><button className="icon-danger" title="حذف دانش‌آموز" onClick={()=>deleteStudent(s.id)}><Trash2 size={15}/></button></div></td></tr>)}{visible.length===0&&<tr><td colSpan="7" className="empty">دانش‌آموزی با این مشخصات پیدا نشد.</td></tr>}</tbody></table></div><div className="table-foot"><span>نمایش {visible.length} نفر از {students.length} دانش‌آموز</span><span className="foot-note"><Clock3 size={14}/> اطلاعات دانش‌آموزان در Supabase ذخیره می‌شود.</span></div></section>
      </> : active==='برنامه هفتگی' ? <>
        <section className="panel"><div className="panel-head"><div><h3>همه برنامه‌های هفتگی</h3><p>برنامه‌های ثبت‌شده برای دانش‌آموزان ویژه.</p></div></div>{plansError&&<p className="student-data-error">{plansError}</p>}{plansLoading&&<p className="hint">در حال دریافت برنامه‌ها…</p>}{allPlans.length===0?<div className="empty-panel"><div className="empty-icon"><CalendarDays size={25}/></div><h3>هنوز برنامه‌ای ثبت نشده</h3><p>برای ساخت برنامه، وارد پرونده یک دانش‌آموز ویژه شو.</p></div>:<div className="plan-list">{allPlans.map(p=><div className="plan-row" key={p.id}><div className="plan-row-icon"><CalendarDays size={20}/></div><div className="plan-row-info"><b>{p.title}</b><small>{p.student.name} · {p.start||'—'} تا {p.end||'—'}</small></div><button className="secondary-btn" onClick={()=>{openProfile(p.student);setProfileTab('plans');setViewingPlan(p)}}>مشاهده برنامه</button></div>)}</div>}</section>
      </> : active==='گزارش‌های روزانه' ? <>
        <section className="panel"><div className="panel-head"><div><h3>گزارش‌های روزانه دانش‌آموزان</h3><p>گزارش‌های ذخیره‌شده در دیتابیس.</p></div></div>{reportsError&&<p className="student-data-error">{reportsError}</p>}{allReports.length===0?<div className="empty-panel"><div className="empty-icon"><ClipboardList size={25}/></div><h3>هنوز گزارشی ثبت نشده</h3><p>گزارش‌های ارسالی دانش‌آموزان ویژه اینجا نمایش داده می‌شوند.</p></div>:<div className="plan-list">{allReports.map(r=><div className="plan-row" key={r.id}><div className="plan-row-icon"><ClipboardList size={20}/></div><div className="plan-row-info"><b>{r.student.name} · {formatJalaliDate(r.date)}</b><small>{r.items.length} فعالیت · درس‌های خوانده‌نشده: {r.unread||'—'}</small></div><span className="pill normal">ثبت‌شده</span></div>)}</div>}</section>
      </> : active==='فیش‌های پرداخت' ? <>
        <section className="panel">
          <div className="panel-head"><div><h3>فیش‌های پرداخت دانش‌آموزان</h3><p>فیش‌ها را بررسی کن؛ فقط فیش تأییدشده به سوابق دریافتی اضافه می‌شود.</p></div><span className="pill special">{allReceipts.filter(r=>r.status==='در انتظار بررسی').length} در انتظار بررسی</span></div>
          {allReceipts.length===0 ? <div className="empty-panel"><div className="empty-icon"><FileText size={25}/></div><h3>هنوز فیشی ارسال نشده</h3><p>فیش‌هایی که دانش‌آموزان از پنل خود ارسال می‌کنند اینجا نمایش داده می‌شوند.</p></div> :
            <div className="plan-list">{allReceipts.map(r=><div className="panel receipt-review-card" key={r.id} style={{marginBottom:12}}>
              <div className="panel-head">
                <div><h3>{r.student.name}</h3><p>{(Number(r.amount)||0).toLocaleString('fa-IR')} تومان · {r.date||'بدون تاریخ'}</p></div>
                <span className={`pill ${r.status==='تأیید شد'?'normal':r.status==='رد شد'?'':'special'}`}>{r.status}</span>
              </div>
              {r.note&&<p className="panel-sub">توضیحات دانش‌آموز: {r.note}</p>}
              <div className="file-picked"><FileText size={17}/><span>{r.fileName}</span><a href={r.fileUrl} target="_blank" rel="noreferrer">مشاهده فایل فیش</a></div>
              {r.reviewNote&&<p className="hint">دلیل رد: {r.reviewNote}</p>}
              {r.status==='در انتظار بررسی'&&<div className="modal-actions">
                <button className="secondary-btn" onClick={()=>rejectReceipt(r.student.id,r.id)}>رد فیش</button>
                <button className="primary-btn" onClick={()=>approveReceipt(r.student.id,r.id)}>تأیید فیش و ثبت پرداخت</button>
              </div>}
            </div>)}</div>}
        </section>
      </> : <>
        <section className="panel"><div className="panel-head"><div><h3>تنظیمات سامانه</h3><p>تنظیمات پایه EduPanel.</p></div></div><div className="info-grid"><Info label="نام سامانه" value="EduPanel"/><Info label="وضعیت اتصال Supabase" value="متصل و فعال"/><Info label="نوع نسخه" value="پیش‌نمایش محلی"/><Info label="ذخیره اطلاعات" value="پرونده دانش‌آموزان در Supabase"/></div><div className="notice">ورود مدیر و اطلاعات پرونده دانش‌آموزان از طریق Supabase مدیریت می‌شود؛ برنامه‌ها، گزارش‌ها، فیش‌ها و امور مالی هنوز در مرحله اتصال به دیتابیس هستند.</div></section>
      </>}
      <footer>EduPanel <span>·</span> نسخه سوم · سازنده برنامه هفتگی</footer>
    </main>
    {showModal&&<div className="overlay" onMouseDown={e=>e.target===e.currentTarget&&setShowModal(false)}><form className="modal" onSubmit={addStudent}><div className="modal-head"><div><h3>{editingStudentId ? 'ویرایش دانش‌آموز' : 'افزودن دانش‌آموز'}</h3><p>مشخصات اولیه دانش‌آموز رو وارد کن.</p></div><button type="button" className="close" onClick={()=>setShowModal(false)}><X size={20}/></button></div><label>نام و نام خانوادگی<input required autoFocus value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="مثلاً علی رضایی"/></label><div className="form-row"><label>رشته تحصیلی<select required value={form.field} onChange={e=>setForm({...form,field:e.target.value})}><option value="">انتخاب رشته</option><option>مکانیک</option><option>الکتروتکنیک</option><option>حسابداری</option><option>کامپیوتر</option></select></label><label>پایه تحصیلی<select value={form.grade} onChange={e=>setForm({...form,grade:e.target.value})}><option>دهم</option><option>یازدهم</option><option>دوازدهم</option></select></label></div><div className="form-row"><label>کد ملی<input inputMode="numeric" maxLength="10" value={form.nationalId} onChange={e=>setForm({...form,nationalId:e.target.value.replace(/\D/g,'').slice(0,10)})} placeholder="۱۰ رقم کد ملی"/></label><label>شماره تماس<input inputMode="tel" value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} placeholder="مثلاً ۰۹۱۲..."/></label></div><label>نوع دانش‌آموز<select value={form.type} onChange={e=>setForm({...form,type:e.target.value})}><option value="عادی">عادی — بدون برنامه اختصاصی و گزارش کار</option><option value="ویژه">ویژه — برنامه هفتگی اختصاصی و ارسال گزارش</option></select></label><div className="modal-actions"><button type="button" className="secondary-btn" onClick={()=>setShowModal(false)}>انصراف</button><button className="primary-btn" type="submit"><Plus size={17}/> {editingStudentId ? 'ذخیره تغییرات' : 'ثبت دانش‌آموز'}</button></div>{studentsError&&<p className="student-data-error">{studentsError}</p>}</form></div>}
  </div>;
}

function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let alive = true;
    supabase.auth.getSession().then(({ data, error }) => {
      if (!alive) return;
      if (error) setAuthError('بازیابی نشست با خطا روبه‌رو شد: ' + error.message);
      setSession(data?.session ?? null);
      setAuthLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!alive) return;
      setSession(nextSession);
      setProfile(null);
      setAuthError('');
      setAuthLoading(false);
    });
    return () => {
      alive = false;
      listener?.subscription?.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let alive = true;
    async function loadProfile() {
      if (!session?.user?.id) {
        setProfile(null);
        setProfileLoading(false);
        return;
      }
      setProfileLoading(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, role')
        .eq('id', session.user.id)
        .maybeSingle();
      if (!alive) return;
      if (error) {
        setAuthError('دریافت نقش کاربر ناموفق بود: ' + error.message);
        setProfile(null);
      } else if (!data) {
        setAuthError('برای این حساب، پروفایل کاربری در جدول profiles پیدا نشد. مدیر سامانه باید پروفایل را ایجاد کند.');
        setProfile(null);
      } else {
        setProfile({ ...data, email: session.user.email });
        setAuthError('');
      }
      setProfileLoading(false);
    }
    loadProfile();
    return () => { alive = false; };
  }, [session?.user?.id]);

  const handleSignIn = async (event) => {
    event.preventDefault();
    setAuthError('');
    setSubmitting(true);
    const loginValue = email.trim();
    const normalizedLogin = toEnglishDigits(loginValue).replace(/\s/g, '');
    const loginEmail = normalizedLogin.includes('@')
      ? normalizedLogin
      : studentLoginEmail(normalizedLogin);
    const { error } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password
    });
    if (error) setAuthError(error.message === 'Invalid login credentials'
      ? 'کد ملی/ایمیل یا رمز عبور اشتباه است.'
      : 'ورود انجام نشد: ' + error.message);
    setSubmitting(false);
  };

  const handleSignOut = async () => {
    setAuthError('');
    const { error } = await supabase.auth.signOut();
    if (error) setAuthError('خروج از حساب انجام نشد: ' + error.message);
  };

  if (authLoading || (session && profileLoading)) {
    return <div className="auth-screen"><div className="auth-card"><div className="auth-mark">EP</div><h1>EduPanel</h1><p>در حال بررسی حساب کاربری…</p></div></div>;
  }

  if (!session) {
    return <div className="auth-screen" dir="rtl">
      <form className="auth-card" onSubmit={handleSignIn}>
        <div className="auth-mark">EP</div>
        <span className="auth-kicker">سامانه مدیریت آموزشی</span>
        <h1>ورود به EduPanel</h1>
        <p className="auth-description">دانش‌آموزان با کد ملی و شماره همراه، و مدیر با ایمیل و رمز عبور وارد شوند.</p>
        <label className="auth-label">کد ملی / ایمیل مدیر
          <input type="text" inputMode="text" autoComplete="username" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="کد ملی یا ایمیل مدیر"/>
        </label>
        <label className="auth-label">رمز عبور
          <input type="password" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)} placeholder="شماره همراه دانش‌آموز / رمز مدیر"/>
        </label>
        {authError && <div className="auth-error" role="alert">{authError}</div>}
        <button className="primary-btn auth-submit" type="submit" disabled={submitting}>
          {submitting ? 'در حال ورود…' : 'ورود به حساب'}
        </button>
        <small className="auth-footnote">ورود امن از طریق Supabase</small>
      </form>
    </div>;
  }

  if (!profile) {
    return <div className="auth-screen" dir="rtl"><div className="auth-card">
      <div className="auth-mark">EP</div><h1>پروفایل در دسترس نیست</h1>
      <p className="auth-description">{authError || 'اطلاعات نقش این حساب قابل دریافت نیست.'}</p>
      <button className="primary-btn auth-submit" onClick={handleSignOut}>خروج از حساب</button>
    </div></div>;
  }

  if (profile.role === 'manager') {
    return <ManagerApp profile={{...profile, email: session.user.email}} onSignOut={handleSignOut}/>;
  }

  if (profile.role === 'student') {
    return <StudentApp profile={profile} onSignOut={handleSignOut} />;
  }

  return <div className="auth-screen" dir="rtl"><div className="auth-card">
    <h1>نقش کاربری نامعتبر</h1><p className="auth-description">نقش تعریف‌شده برای این حساب پشتیبانی نمی‌شود.</p>
    <button className="primary-btn auth-submit" onClick={handleSignOut}>خروج از حساب</button>
  </div></div>;
}


function StudentApp({ profile, onSignOut }) {
  const [student, setStudent] = useState(null);
  const [contracts, setContracts] = useState([]);
  const [studentPlans, setStudentPlans] = useState([]);
  const [studentReports, setStudentReports] = useState([]);
  const [reportsError, setReportsError] = useState('');
  const [reportDate, setReportDate] = useState(toIsoDate(new Date()));
  const [reportItems, setReportItems] = useState([{id:1,subject:'',hours:'',tests:'',correct:'',wrong:'',unanswered:''}]);
  const [reportUnread, setReportUnread] = useState('ندارم');
  const [reportSaving, setReportSaving] = useState(false);
  const [plansError, setPlansError] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [contractError, setContractError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const loadStudentData = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError('');
    setContractError('');

    const { data: studentRow, error: studentLoadError } = await supabase
      .from('students')
      .select('id,full_name,field,grade,student_type')
      .eq('user_id', profile.id)
      .maybeSingle();

    if (studentLoadError) {
      setError('دریافت اطلاعات دانش‌آموز ناموفق بود: ' + studentLoadError.message);
      setLoading(false);
      setRefreshing(false);
      return;
    }
    if (!studentRow) {
      setError('پرونده دانش‌آموز به این حساب متصل نیست. از مدیر بخواه پرونده را ویرایش و ذخیره کند تا حساب ورود به آن متصل شود.');
      setLoading(false);
      setRefreshing(false);
      return;
    }

    setStudent(studentRow);
    const { data: contractsData, error: contractsLoadError } = await supabase
      .from('contracts')
      .select('id,amount,plan_count,duration_days,start_date,end_date,notes,created_at,previous_contract_id')
      .eq('student_id', studentRow.id)
      .order('created_at', { ascending: false });

    if (contractsLoadError) {
      setContractError(contractsLoadError.message);
      setContracts([]);
    } else {
      setContracts(contractsData || []);
    }

    if (studentRow.student_type === 'special') {
      const { data: plansData, error: plansLoadError } = await supabase
        .from('weekly_plans')
        .select('id,title,start_date,end_date,days,created_at')
        .eq('student_id', studentRow.id)
        .order('created_at', { ascending: false });
      if (plansLoadError) {
        setPlansError(plansLoadError.message);
        setStudentPlans([]);
      } else {
        setPlansError('');
        setStudentPlans((plansData || []).map(row => ({
          id: row.id,
          title: row.title,
          start: row.start_date || '',
          end: row.end_date || '',
          days: Array.isArray(row.days) ? row.days : []
        })));
      }
      const { data: reportsData, error: reportsLoadError } = await supabase
        .from('daily_reports')
        .select('id,report_date,items,unread,created_at')
        .eq('student_id', studentRow.id)
        .order('report_date', { ascending: false })
        .order('created_at', { ascending: false });
      if (reportsLoadError) {
        setReportsError(reportsLoadError.message);
        setStudentReports([]);
      } else {
        setReportsError('');
        setStudentReports((reportsData || []).map(row => ({
          id: row.id,
          date: row.report_date,
          items: Array.isArray(row.items) ? row.items : [],
          unread: row.unread || '',
          createdAt: row.created_at
        })));
      }
    } else {
      setStudentPlans([]);
      setPlansError('');
      setStudentReports([]);
      setReportsError('');
    }
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    loadStudentData(false);
  }, [profile.id]);

  const addStudentReportItem = () => setReportItems(prev => [...prev, {
    id: Date.now() + Math.random(), subject:'', hours:'', tests:'', correct:'', wrong:'', unanswered:''
  }]);

  const submitDailyReport = async event => {
    event.preventDefault();
    if (!student || student.student_type !== 'special' || !reportDate) return;
    const cleanedItems = reportItems
      .filter(item => item.subject.trim() || item.hours || item.tests || item.correct || item.wrong || item.unanswered)
      .map(({id, ...item}) => ({
        subject: item.subject.trim(),
        hours: item.hours.trim(),
        tests: item.tests.trim(),
        correct: item.correct.trim(),
        wrong: item.wrong.trim(),
        unanswered: item.unanswered.trim()
      }));
    if (!cleanedItems.length) {
      setReportsError('حداقل یک فعالیت را تکمیل کن.');
      return;
    }
    setReportSaving(true);
    setReportsError('');
    const { data, error } = await supabase
      .from('daily_reports')
      .insert({
        student_id: student.id,
        report_date: reportDate,
        items: cleanedItems,
        unread: reportUnread.trim() || 'ندارم'
      })
      .select('id,report_date,items,unread,created_at')
      .single();
    setReportSaving(false);
    if (error) {
      setReportsError('ثبت گزارش ناموفق بود: ' + error.message);
      return;
    }
    setStudentReports(prev => [{
      id: data.id,
      date: data.report_date,
      items: Array.isArray(data.items) ? data.items : [],
      unread: data.unread || '',
      createdAt: data.created_at
    }, ...prev]);
    setReportItems([{id:Date.now(),subject:'',hours:'',tests:'',correct:'',wrong:'',unanswered:''}]);
    setReportUnread('ندارم');
    alert('گزارش روزانه با موفقیت ثبت شد.');
  };

  const getStudentContractStatus = endDate => {
    if (!endDate) return { label: 'تاریخ پایان ثبت نشده', tone: 'normal' };
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const end = new Date(`${endDate}T00:00:00`);
    const diff = Math.ceil((end - today) / 86400000);
    if (diff > 1) return { label: `${diff} روز تا پایان قرارداد`, tone: 'normal' };
    if (diff === 1) return { label: 'فردا پایان قرارداد', tone: 'warning' };
    if (diff === 0) return { label: 'امروز پایان قرارداد است', tone: 'warning' };
    return { label: `${Math.abs(diff)} روز از پایان قرارداد گذشته`, tone: 'danger' };
  };

  const latestContract = contracts[0] || null;
  const contractAccessDenied = /permission|row-level security|rls|not allowed/i.test(contractError);

  return <div className="student-app" dir="rtl">
    <header className="student-topbar">
      <div className="student-brand"><div className="auth-mark">EP</div><div><b>EduPanel</b><small>پنل دانش‌آموزی</small></div></div>
      <button className="secondary-btn" onClick={onSignOut}>خروج از حساب</button>
    </header>
    {loading ? <section className="panel student-loading"><p>در حال دریافت اطلاعات حساب شما…</p></section> : error ? <section className="panel student-error"><h2>اطلاعات حساب در دسترس نیست</h2><p>{error}</p><button className="secondary-btn" onClick={()=>loadStudentData(false)}>تلاش دوباره</button></section> : <>
      <section className="student-welcome">
        <div><span>داشبورد دانش‌آموز</span><h1>سلام {student.full_name || profile.full_name || 'دانش‌آموز'} 👋</h1><p>به پنل آموزشی خودت خوش آمدی.</p></div>
        <div className="student-welcome-mark"><GraduationCap size={42}/></div>
      </section>
      <section className="student-dashboard-grid">
        <article className="panel student-detail-card">
          <div className="student-section-title"><UserRound size={18}/><h3>اطلاعات من</h3></div>
          <div className="student-detail-grid">
            <Info label="نام و نام خانوادگی" value={student.full_name || '—'}/>
            <Info label="رشته تحصیلی" value={student.field || 'ثبت نشده'}/>
            <Info label="پایه تحصیلی" value={student.grade || '—'}/>
            <Info label="نوع عضویت" value={student.student_type === 'special' ? 'ویژه' : 'عادی'}/>
          </div>
        </article>
        <article className="panel student-detail-card student-contract-card">
          <div className="student-section-title"><FileText size={18}/><h3>وضعیت قرارداد</h3><button className="student-refresh-btn" onClick={()=>loadStudentData(true)} disabled={refreshing}>{refreshing ? 'در حال بروزرسانی…' : 'بروزرسانی'}</button></div>
          {contractError ? <div className="student-inline-error"><b>قراردادها از دیتابیس دریافت نشدند.</b><p>{contractError}</p>{contractAccessDenied&&<p>دسترسی خواندن قرارداد برای حساب دانش‌آموز فعال نیست. فایل SQL همراه این نسخه را در Supabase اجرا کن.</p>}</div> : latestContract ? <>
            <div className={`student-contract-status ${getStudentContractStatus(latestContract.end_date).tone}`}>{getStudentContractStatus(latestContract.end_date).label}</div>
            <div className="student-detail-grid">
              <Info label="مبلغ قرارداد" value={`${Number(latestContract.amount || 0).toLocaleString('fa-IR')} تومان`}/>
              <Info label="تعداد برنامه" value={latestContract.plan_count ?? '—'}/>
              <Info label="تاریخ شروع" value={formatJalaliDate(latestContract.start_date)}/>
              <Info label="تاریخ پایان" value={formatJalaliDate(latestContract.end_date)}/>
            </div>
            {latestContract.notes && <p className="student-contract-note">توضیحات: {latestContract.notes}</p>}
          </> : <p className="student-empty-note">هنوز قراردادی برای حساب شما ثبت نشده است. اگر قرارداد بسته‌ای، از مدیر بخواه آن را در پرونده‌ات ثبت کند.</p>}
        </article>
      </section>
      <section className="panel student-contract-history">
        <div className="student-section-title"><ClipboardList size={18}/><h3>سوابق و تمدیدهای قرارداد</h3><span className="student-contract-count">{contracts.length.toLocaleString('fa-IR')} قرارداد</span></div>
        {contractError ? <p className="student-empty-note">به دلیل خطای دسترسی، تاریخچه قراردادها نمایش داده نمی‌شود.</p> : contracts.length === 0 ? <p className="student-empty-note">سابقه‌ای برای نمایش وجود ندارد.</p> : <div className="student-contract-history-list">
          {contracts.map((item, index) => {
            const status = getStudentContractStatus(item.end_date);
            return <article className="student-contract-history-item" key={item.id}>
              <div className="student-contract-history-top"><b>{index === 0 ? 'آخرین قرارداد' : `قرارداد شماره ${contracts.length - index}`}</b><span className={`student-contract-status ${status.tone}`}>{status.label}</span></div>
              <div className="student-detail-grid">
                <Info label="مبلغ" value={`${Number(item.amount || 0).toLocaleString('fa-IR')} تومان`}/>
                <Info label="تعداد برنامه" value={item.plan_count ?? '—'}/>
                <Info label="شروع" value={formatJalaliDate(item.start_date)}/>
                <Info label="پایان" value={formatJalaliDate(item.end_date)}/>
              </div>
              {item.notes && <p className="student-contract-note">{item.notes}</p>}
            </article>;
          })}
        </div>}
      </section>
      {student.student_type === 'special' && <section className="panel student-next-steps">
        <div className="student-section-title"><CalendarDays size={18}/><h3>برنامه‌های هفتگی من</h3><span className="student-contract-count">{studentPlans.length.toLocaleString('fa-IR')} برنامه</span></div>
        {plansError ? <p className="student-inline-error">دریافت برنامه‌ها ناموفق بود: {plansError}</p> : studentPlans.length === 0 ? <p className="student-empty-note">هنوز برنامه هفتگی برای شما ثبت نشده است.</p> : <div className="student-plan-list">{studentPlans.map(plan => <details className="portal-plan" key={plan.id}>
          <summary><b>{plan.title}</b><span>{plan.start ? formatJalaliDate(plan.start) : '—'} تا {plan.end ? formatJalaliDate(plan.end) : '—'}</span></summary>
          {(plan.days || []).map(day => <div className="portal-day" key={day.day}><b>{day.day}</b><div>{(day.blocks || []).map(block => <div className="portal-block" key={block.id}><strong>{block.title} · {block.time}</strong>{(block.lessons || []).length === 0 ? <p>درسی در این بازه ثبت نشده</p> : block.lessons.map(lesson => <p key={lesson.id}>{lesson.subject || 'بدون نام'} — {lesson.topic || 'بدون مبحث'} — {formatDuration(lesson)} ({formatActivity(lesson.activity)})</p>)}</div>)}</div></div>)}
        </details>)}</div>}
      </section>}
      {student.student_type === 'special' && <section className="panel student-next-steps">
        <div className="student-section-title"><ClipboardList size={18}/><h3>ارسال گزارش روزانه</h3></div>
        <form onSubmit={submitDailyReport} className="student-report-form" style={{display:'grid',gap:16}}> 
          <JalaliDatePicker label="تاریخ گزارش" required value={reportDate} onChange={setReportDate}/>
          <div className="report-item-list">
            {reportItems.map((item,index)=><div className="report-edit-card" key={item.id}>
              <div className="lesson-card-head"><b>فعالیت {index+1}</b>{reportItems.length>1&&<button type="button" className="icon-danger" onClick={()=>setReportItems(prev=>prev.filter(row=>row.id!==item.id))}><Trash2 size={14}/></button>}</div>
              <div className="lesson-fields">
                {[
                  ['subject','نام درس','text'],['hours','ساعت مطالعه','text'],['tests','تعداد تست','number'],
                  ['correct','درست','number'],['wrong','غلط','number'],['unanswered','نزده','number']
                ].map(([field,label,type])=><label key={field}>{label}<input type={type} min={type==='number'?'0':undefined} value={item[field]} onChange={e=>setReportItems(prev=>prev.map(row=>row.id===item.id?{...row,[field]:e.target.value}:row))}/></label>)}
              </div>
            </div>)}
          </div>
          <button type="button" className="secondary-btn" onClick={addStudentReportItem}><Plus size={15}/> افزودن فعالیت</button>
          <label className="portal-label">درس‌های خوانده‌نشده<input value={reportUnread} onChange={e=>setReportUnread(e.target.value)}/></label>
          {reportsError&&<p className="student-inline-error">{reportsError}</p>}
          <button className="primary-btn" type="submit" disabled={reportSaving}>{reportSaving?'در حال ثبت…':'ثبت گزارش روزانه'}</button>
        </form>
      </section>}
      {student.student_type === 'special' && <section className="panel student-next-steps">
        <div className="student-section-title"><ClipboardList size={18}/><h3>گزارش‌های قبلی من</h3><span className="student-contract-count">{studentReports.length.toLocaleString('fa-IR')} گزارش</span></div>
        {reportsError&&<p className="student-inline-error">{reportsError}</p>}
        {studentReports.length===0?<p className="student-empty-note">هنوز گزارشی ثبت نکرده‌ای.</p>:<div className="student-plan-list">{studentReports.map(report=><details className="portal-plan" key={report.id}>
          <summary><b>گزارش {formatJalaliDate(report.date)}</b><span>{report.items.length} فعالیت · {report.createdAt?new Date(report.createdAt).toLocaleString('fa-IR'):'—'}</span></summary>
          <div className="table-wrap"><table><thead><tr><th>درس</th><th>ساعت</th><th>تست</th><th>درست</th><th>غلط</th><th>نزده</th></tr></thead><tbody>{report.items.map((item,index)=><tr key={index}><td>{item.subject||'—'}</td><td>{item.hours||'—'}</td><td>{item.tests||'—'}</td><td>{item.correct||'—'}</td><td>{item.wrong||'—'}</td><td>{item.unanswered||'—'}</td></tr>)}</tbody></table></div>
          <p className="hint">درس‌های خوانده‌نشده: {report.unread||'ندارد'}</p>
        </details>)}</div>}
      </section>}
      <section className="panel student-next-steps">
        <div className="student-section-title"><LayoutDashboard size={18}/><h3>بخش‌های پنل</h3></div>
        <div className="student-feature-grid">
          {student.student_type === 'special' && <div><CalendarDays size={21}/><b>برنامه هفتگی</b><small>برنامه‌های ثبت‌شده توسط مدیر را اینجا مشاهده می‌کنی.</small></div>}
          <div><ClipboardList size={21}/><b>گزارش عملکرد</b><small>ثبت گزارش روزانه و مشاهده سوابق از همین پنل فعال است.</small></div>
          <div><FileText size={21}/><b>امور مالی</b><small>نمایش پرداخت‌ها و ارسال فیش در مرحله بعد متصل می‌شود.</small></div>
        </div>
      </section>
    </>}
    <footer>EduPanel · پنل دانش‌آموزی</footer>
  </div>;
}

function Info({label,value}){return <div className="info-item"><small>{label}</small><b>{value}</b></div>}
function Stat({icon,label,value,note,color}){return <div className="stat-card"><div className={`stat-icon ${color}`}>{icon}</div><div><span>{label}</span><strong>{value}</strong><small>{note}</small></div></div>}
createRoot(document.getElementById('root')).render(<App/>);
