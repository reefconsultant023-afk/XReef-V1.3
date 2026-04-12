import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, MessageSquare, Clock, CheckCircle, AlertCircle, Trash2, X, Loader2, Sparkles, Mail, Lock, LogIn, UserPlus } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { auth, db, signInWithGoogle, signInWithEmail, signUpWithEmail, handleFirestoreError, OperationType } from '../firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { collection, doc, setDoc, onSnapshot, query, orderBy, deleteDoc } from 'firebase/firestore';

interface SupportTicket {
  id: string;
  title: string;
  description: string;
  status: 'open' | 'in-progress' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high';
  createdAt: number;
  userId: string;
}

export default function SupportPage() {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  
  // Auth State
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(false);

  const [newTicket, setNewTicket] = useState({
    title: '',
    description: '',
    priority: 'medium' as const
  });

  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!isAuthReady) return;

    if (user) {
      const ticketsRef = collection(db, `users/${user.uid}/supportTickets`);
      const q = query(ticketsRef, orderBy('createdAt', 'desc'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const ticketsData: SupportTicket[] = [];
        snapshot.forEach((doc) => {
          ticketsData.push(doc.data() as SupportTicket);
        });
        setTickets(ticketsData);
      }, (error) => {
        handleFirestoreError(error, OperationType.GET, `users/${user.uid}/supportTickets`);
      });
      return () => unsubscribe();
    } else {
      setTickets([]);
    }
  }, [user, isAuthReady]);

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAuthLoading(true);
    setAuthError(null);
    try {
      if (authMode === 'login') {
        await signInWithEmail(email, password);
      } else {
        await signUpWithEmail(email, password);
      }
      setEmail('');
      setPassword('');
    } catch (err: any) {
      console.error("Auth error:", err);
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        setAuthError("البريد الإلكتروني أو كلمة المرور غير صحيحة.");
      } else if (err.code === 'auth/email-already-in-use') {
        setAuthError("البريد الإلكتروني مستخدم بالفعل.");
      } else if (err.code === 'auth/weak-password') {
        setAuthError("كلمة المرور ضعيفة، يجب أن تكون 6 أحرف على الأقل.");
      } else {
        setAuthError(err.message || "حدث خطأ أثناء المصادقة.");
      }
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    setAuthError(null);
    try {
      await signInWithGoogle();
    } catch (err: any) {
      setAuthError("حدث خطأ أثناء تسجيل الدخول بحساب Google.");
    }
  };

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTicket.title.trim() || !newTicket.description.trim() || !user) return;

    const ticket: SupportTicket = {
      id: Date.now().toString(),
      title: newTicket.title.trim(),
      description: newTicket.description.trim(),
      status: 'open',
      priority: newTicket.priority,
      createdAt: Date.now(),
      userId: user.uid
    };

    try {
      await setDoc(doc(db, `users/${user.uid}/supportTickets`, ticket.id), ticket);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `users/${user.uid}/supportTickets`);
    }

    setNewTicket({ title: '', description: '', priority: 'medium' });
    setIsModalOpen(false);
  };

  const resolveTicket = async (id: string) => {
    if (!user) return;
    try {
      await setDoc(doc(db, `users/${user.uid}/supportTickets`, id), {
        status: 'resolved'
      }, { merge: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}/supportTickets`);
    }
  };

  const deleteTicket = async (id: string) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, `users/${user.uid}/supportTickets`, id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `users/${user.uid}/supportTickets`);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'open': return <AlertCircle className="text-blue-400" size={18} />;
      case 'in-progress': return <Clock className="text-yellow-400" size={18} />;
      case 'resolved': return <CheckCircle className="text-green-400" size={18} />;
      default: return <MessageSquare className="text-gray-400" size={18} />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-500/10 text-red-500 border-red-500/20';
      case 'medium': return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
      case 'low': return 'bg-green-500/10 text-green-500 border-green-500/20';
      default: return 'bg-gray-500/10 text-gray-500 border-gray-500/20';
    }
  };

  if (!isAuthReady) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-black text-white font-sans selection:bg-blue-500/30 flex items-center justify-center p-4 relative" dir="rtl">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(37,99,235,0.15)_0%,transparent_100%)]"></div>
        <div className="bg-gray-900/80 backdrop-blur-xl border border-blue-500/30 p-8 rounded-3xl shadow-2xl max-w-md w-full relative z-10">
          <div className="flex justify-center mb-6">
            <Sparkles className="w-12 h-12 text-blue-500" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2 text-center">
            مرحباً بك في Xreef
          </h2>
          <p className="text-gray-400 text-center mb-6 text-sm">
            يرجى تسجيل الدخول للوصول إلى الدعم الفني
          </p>

          {authError && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-3 rounded-xl mb-4 text-sm">
              {authError}
            </div>
          )}

          <form onSubmit={handleEmailAuth} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">البريد الإلكتروني</label>
              <div className="relative">
                <Mail className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input 
                  type="email" 
                  required 
                  value={email} 
                  onChange={e => setEmail(e.target.value)} 
                  className="w-full pl-4 pr-10 py-3 bg-black/50 border border-gray-700 rounded-xl text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all" 
                  dir="ltr" 
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">كلمة المرور</label>
              <div className="relative">
                <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input 
                  type="password" 
                  required 
                  minLength={6} 
                  value={password} 
                  onChange={e => setPassword(e.target.value)} 
                  className="w-full pl-4 pr-10 py-3 bg-black/50 border border-gray-700 rounded-xl text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all" 
                  dir="ltr" 
                />
              </div>
            </div>
            <button 
              type="submit" 
              disabled={isAuthLoading} 
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl transition-colors flex justify-center items-center gap-2 mt-2"
            >
              {isAuthLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                authMode === 'login' ? <LogIn className="w-5 h-5" /> : <UserPlus className="w-5 h-5" />
              )}
              {authMode === 'login' ? 'دخول' : 'تسجيل'}
            </button>
          </form>

          <div className="mt-6 flex items-center justify-between">
            <hr className="w-full border-gray-700" />
            <span className="px-3 text-gray-500 text-sm">أو</span>
            <hr className="w-full border-gray-700" />
          </div>

          <button 
            onClick={handleGoogleAuth}
            className="w-full mt-6 bg-white hover:bg-gray-100 text-gray-900 font-bold py-3 rounded-xl transition-colors flex justify-center items-center gap-2"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            المتابعة باستخدام Google
          </button>

          <div className="mt-6 text-center">
            <button 
              onClick={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')}
              className="text-blue-400 hover:text-blue-300 text-sm font-medium transition-colors"
            >
              {authMode === 'login' ? 'لا تملك حساباً؟ سجل الآن' : 'لديك حساب بالفعل؟ سجل دخولك'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white p-8 font-sans" dir="rtl">
      <div className="max-w-4xl mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 mb-12">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => navigate('/')}
              className="p-3 bg-gray-900 hover:bg-gray-800 rounded-2xl transition-colors border border-gray-800"
            >
              <ArrowLeft size={20} className="rotate-180" />
            </button>
            <div>
              <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-blue-600">
                الدعم الفني والملاحظات
              </h1>
              <p className="text-gray-400 mt-1">الإبلاغ عن المشاكل أو اقتراح تحسينات</p>
            </div>
          </div>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-xl transition-all hover:scale-105 active:scale-95 shadow-lg shadow-blue-900/20"
          >
            <Plus size={20} /> تذكرة جديدة
          </button>
        </div>

        {!isAuthReady ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        ) : tickets.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed border-gray-800 rounded-3xl bg-gray-900/20">
            <MessageSquare className="w-16 h-16 text-gray-700 mb-4" />
            <h3 className="text-xl font-medium text-gray-400">لا توجد تذاكر بعد</h3>
            <p className="text-gray-500 mb-8 text-center max-w-sm">
              إذا كنت تواجه أي مشاكل أو لديك اقتراحات، يرجى إنشاء تذكرة.
            </p>
            <button 
              onClick={() => setIsModalOpen(true)}
              className="text-blue-500 hover:text-blue-400 font-medium"
            >
              + إنشاء تذكرة دعم
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <AnimatePresence mode="popLayout">
              {tickets.map(ticket => (
                <motion.div 
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  key={ticket.id}
                  className="bg-gray-900/50 p-6 rounded-2xl border border-gray-800 hover:border-gray-700 transition-all backdrop-blur-sm"
                >
                  <div className="flex justify-between items-start gap-4">
                    <div className="flex-grow">
                      <div className="flex items-center gap-3 mb-2">
                        {getStatusIcon(ticket.status)}
                        <h2 className="font-bold text-xl">{ticket.title}</h2>
                        <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border ${getPriorityColor(ticket.priority)}`}>
                          {ticket.priority === 'high' ? 'عالية' : ticket.priority === 'medium' ? 'متوسطة' : 'منخفضة'}
                        </span>
                      </div>
                      <p className="text-gray-400 text-sm mb-4 whitespace-pre-wrap">{ticket.description}</p>
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <Clock size={12} />
                          {new Date(ticket.createdAt).toLocaleString('ar-EG')}
                        </span>
                        <span className="capitalize px-2 py-0.5 bg-gray-800 rounded-md">
                          الحالة: {ticket.status === 'open' ? 'مفتوحة' : ticket.status === 'in-progress' ? 'قيد المعالجة' : ticket.status === 'resolved' ? 'محلولة' : 'مغلقة'}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {ticket.status !== 'resolved' && (
                        <button 
                          onClick={() => resolveTicket(ticket.id)}
                          className="p-2 text-gray-600 hover:text-green-500 hover:bg-green-500/10 rounded-lg transition-all"
                          title="تحديد كمحلول"
                        >
                          <CheckCircle size={18} />
                        </button>
                      )}
                      <button 
                        onClick={() => deleteTicket(ticket.id)}
                        className="p-2 text-gray-600 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
                        title="حذف التذكرة"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Create Ticket Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-gray-900 border border-gray-800 w-full max-w-lg rounded-3xl p-8 shadow-2xl"
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold">إنشاء تذكرة دعم</h2>
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="p-2 hover:bg-gray-800 rounded-full transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
              
              <form onSubmit={handleCreateTicket}>
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">عنوان المشكلة</label>
                    <input 
                      autoFocus
                      type="text"
                      required
                      value={newTicket.title}
                      onChange={(e) => setNewTicket({...newTicket, title: e.target.value})}
                      placeholder="ملخص قصير للمشكلة"
                      className="w-full bg-black border border-gray-800 rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500 transition-colors"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">الأولوية</label>
                    <div className="flex gap-2">
                      {(['low', 'medium', 'high'] as const).map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setNewTicket({...newTicket, priority: p})}
                          className={`flex-1 py-2 rounded-xl border transition-all capitalize ${
                            newTicket.priority === p 
                              ? getPriorityColor(p) + ' border-current'
                              : 'bg-black border-gray-800 text-gray-500 hover:border-gray-700'
                          }`}
                        >
                          {p === 'high' ? 'عالية' : p === 'medium' ? 'متوسطة' : 'منخفضة'}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">الوصف</label>
                    <textarea 
                      required
                      rows={4}
                      value={newTicket.description}
                      onChange={(e) => setNewTicket({...newTicket, description: e.target.value})}
                      placeholder="يرجى وصف المشكلة بالتفصيل..."
                      className="w-full bg-black border border-gray-800 rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500 transition-colors resize-none"
                    />
                  </div>

                  <button 
                    type="submit"
                    disabled={!newTicket.title.trim() || !newTicket.description.trim()}
                    className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:hover:bg-blue-600 text-white font-semibold py-4 rounded-xl transition-all shadow-lg shadow-blue-900/20"
                  >
                    إرسال التذكرة
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
