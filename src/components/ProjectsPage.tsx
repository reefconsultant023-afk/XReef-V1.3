import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Folder, Trash2, X, LifeBuoy, Loader2, Sparkles, Mail, Lock, LogIn, UserPlus, LogOut } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { auth, db, signInWithGoogle, signInWithEmail, signUpWithEmail, logOut, handleFirestoreError, OperationType } from '../firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { collection, doc, setDoc, onSnapshot, query, orderBy, deleteDoc } from 'firebase/firestore';

interface Project {
  id: string;
  name: string;
  createdAt: number;
  userId: string;
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const [newProjectName, setNewProjectName] = useState('');
  const navigate = useNavigate();

  // Auth State
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(false);

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
      const projectsRef = collection(db, `users/${user.uid}/projects`);
      const qProjects = query(projectsRef, orderBy('createdAt', 'desc'));
      const unsubProjects = onSnapshot(qProjects, (snapshot) => {
        const projectsData: Project[] = [];
        snapshot.forEach((doc) => {
          projectsData.push(doc.data() as Project);
        });
        setProjects(projectsData);
      }, (error) => {
        handleFirestoreError(error, OperationType.GET, `users/${user.uid}/projects`);
      });

      return () => unsubProjects();
    } else {
      setProjects([]);
    }
  }, [user, isAuthReady]);

  const handleGoogleAuth = async () => {
    setIsAuthLoading(true);
    setAuthError(null);
    try {
      await signInWithGoogle();
    } catch (err: any) {
      setAuthError("حدث خطأ أثناء تسجيل الدخول بحساب Google.");
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleCreateProject = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newProjectName.trim() || !user) return;

    const newProject: Project = {
      id: Date.now().toString(),
      name: newProjectName.trim(),
      createdAt: Date.now(),
      userId: user.uid
    };

    try {
      await setDoc(doc(db, `users/${user.uid}/projects`, newProject.id), newProject);
      setNewProjectName('');
      setIsModalOpen(false);
      navigate(`/project/${newProject.id}`);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `users/${user.uid}/projects`);
    }
  };

  const deleteProject = (project: Project, e: React.MouseEvent) => {
    e.stopPropagation();
    setProjectToDelete(project);
  };

  const confirmDelete = async () => {
    if (!projectToDelete || !user) return;
    try {
      await deleteDoc(doc(db, `users/${user.uid}/projects`, projectToDelete.id));
      setProjectToDelete(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `users/${user.uid}/projects`);
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
            تسجيل الدخول
          </h2>
          <p className="text-gray-400 text-center mb-8 text-sm">
            يرجى استخدام حساب Google للوصول إلى مشاريعك
          </p>

          {authError && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-3 rounded-xl mb-6 text-sm">
              {authError}
            </div>
          )}

          <button 
            onClick={handleGoogleAuth}
            disabled={isAuthLoading}
            className="w-full bg-white hover:bg-gray-100 text-gray-900 font-bold py-4 rounded-xl transition-all flex justify-center items-center gap-3 shadow-lg hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
          >
            {isAuthLoading ? (
              <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
            ) : (
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
            )}
            المتابعة باستخدام Google
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white p-8 font-sans" dir="rtl">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-12">
          <div>
            <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-blue-600">
              مشاريع Xreef 1.6
            </h1>
            <p className="text-gray-400 mt-2">إدارة مشاريع توليد الصور بالذكاء الاصطناعي</p>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => logOut()}
              className="flex items-center gap-2 bg-red-900/20 hover:bg-red-900/40 text-red-400 px-4 py-3 rounded-xl transition-all border border-red-900/50"
              title="تسجيل الخروج"
            >
              <LogOut size={20} />
            </button>
            <button 
              onClick={() => navigate('/support')}
              className="flex items-center gap-2 bg-gray-900 hover:bg-gray-800 text-gray-300 px-6 py-3 rounded-xl transition-all border border-gray-800"
            >
              <LifeBuoy size={20} /> الدعم الفني
            </button>
            <button 
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-xl transition-all hover:scale-105 active:scale-95 shadow-lg shadow-blue-900/20"
            >
              <Plus size={20} /> مشروع جديد
            </button>
          </div>
        </div>

        {projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed border-gray-800 rounded-3xl bg-gray-900/20">
            <Folder className="w-16 h-16 text-gray-700 mb-4" />
            <h3 className="text-xl font-medium text-gray-400">لا توجد مشاريع بعد</h3>
            <p className="text-gray-500 mb-8">قم بإنشاء مشروعك الأول للبدء في توليد الصور</p>
            <button 
              onClick={() => setIsModalOpen(true)}
              className="text-blue-500 hover:text-blue-400 font-medium"
            >
              + إنشاء مشروع
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <AnimatePresence mode="popLayout">
              {projects.map(project => (
                <motion.div 
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  key={project.id}
                  onClick={() => navigate(`/project/${project.id}`)}
                  className="group bg-gray-900/50 p-6 rounded-2xl border border-gray-800 hover:border-blue-500/50 cursor-pointer transition-all hover:bg-gray-900 flex justify-between items-center backdrop-blur-sm"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center group-hover:bg-blue-500/20 transition-colors">
                      <Folder className="text-blue-500" size={24} />
                    </div>
                    <div>
                      <h2 className="font-semibold text-lg group-hover:text-blue-400 transition-colors">{project.name}</h2>
                      <p className="text-sm text-gray-500">{new Date(project.createdAt).toLocaleDateString('ar-EG')}</p>
                    </div>
                  </div>
                  <button 
                    onClick={(e) => deleteProject(project, e)} 
                    className="p-2 text-gray-600 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 size={18} />
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Create Project Modal */}
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
              className="relative bg-gray-900 border border-gray-800 w-full max-w-md rounded-3xl p-8 shadow-2xl"
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold">مشروع جديد</h2>
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="p-2 hover:bg-gray-800 rounded-full transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
              
              <form onSubmit={handleCreateProject}>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">اسم المشروع</label>
                    <input 
                      autoFocus
                      type="text"
                      value={newProjectName}
                      onChange={(e) => setNewProjectName(e.target.value)}
                      placeholder="مثال: تصاميمي الفنية"
                      className="w-full bg-black border border-gray-800 rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500 transition-colors text-lg"
                    />
                  </div>
                  <button 
                    type="submit"
                    disabled={!newProjectName.trim()}
                    className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:hover:bg-blue-600 text-white font-semibold py-4 rounded-xl transition-all mt-4 shadow-lg shadow-blue-900/20"
                  >
                    إنشاء وبدء
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {projectToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setProjectToDelete(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-gray-900 border border-gray-800 w-full max-w-md rounded-3xl p-8 shadow-2xl"
            >
              <div className="text-center">
                <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Trash2 className="text-red-500" size={32} />
                </div>
                <h2 className="text-2xl font-bold mb-2">حذف المشروع؟</h2>
                <p className="text-gray-400 mb-8">
                  هل أنت متأكد من حذف <span className="text-white font-semibold">"{projectToDelete.name}"</span>؟ 
                  لا يمكن التراجع عن هذا الإجراء.
                </p>
                
                <div className="flex gap-3">
                  <button 
                    onClick={() => setProjectToDelete(null)}
                    className="flex-1 bg-gray-800 hover:bg-gray-700 text-white font-semibold py-3 rounded-xl transition-all"
                  >
                    إلغاء
                  </button>
                  <button 
                    onClick={confirmDelete}
                    className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold py-3 rounded-xl transition-all shadow-lg shadow-red-900/20"
                  >
                    حذف المشروع
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
