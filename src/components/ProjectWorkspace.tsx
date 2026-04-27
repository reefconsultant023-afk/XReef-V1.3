import React, { useState, useRef, useEffect } from "react";
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2, Image as ImageIcon, Upload, X, Download, Sparkles, ChevronDown, ChevronUp, Maximize2, Clock, Trash2, Crop, Zap, ImagePlus, Library, Edit2, Plus, Save, LayoutTemplate, Settings2, LogIn, LogOut, Mail, Lock, UserPlus, ArrowLeft, LifeBuoy, Wand2, Folder } from "lucide-react";
import ReactCrop, { type Crop as CropType } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { auth, db, signInWithGoogle, signInWithEmail, signUpWithEmail, logOut, handleFirestoreError, OperationType } from '../firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { collection, doc, setDoc, onSnapshot, query, orderBy, deleteDoc } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import Scene3D from './Scene3D';

interface HistoryItem {
  id: string;
  url: string;
  prompt: string;
  timestamp: number;
}

const DEFAULT_PROMPT_BANK = [
  {
    category: "خيال علمي (Sci-Fi)",
    prompts: [
      { title: "مدينة مستقبلية", prompt: "A futuristic cyberpunk city at night, neon lights, flying cars, highly detailed, 8k resolution, cinematic lighting, Unreal Engine 5 render" },
      { title: "رائد فضاء", prompt: "A highly detailed portrait of an astronaut in a futuristic glowing suit, exploring an alien planet with bioluminescent flora, cinematic, hyperrealistic" },
      { title: "محطة فضائية", prompt: "A massive space station orbiting a gas giant, highly detailed, cinematic lighting, sci-fi concept art, 8k" }
    ]
  },
  {
    category: "طبيعة ومناظر (Nature)",
    prompts: [
      { title: "غابة سحرية", prompt: "A magical enchanted forest with glowing mushrooms, ancient giant trees, ethereal mist, sun rays filtering through leaves, fantasy concept art, trending on ArtStation" },
      { title: "جبال جليدية", prompt: "Majestic snow-capped mountains at sunset, a crystal clear lake reflecting the sky, aurora borealis, photorealistic, National Geographic photography" },
      { title: "شاطئ استوائي", prompt: "A beautiful tropical beach at golden hour, crystal clear turquoise water, palm trees, white sand, highly detailed, photorealistic" }
    ]
  },
  {
    category: "شخصيات (Characters)",
    prompts: [
      { title: "محارب ساموراي", prompt: "A fierce cyberpunk samurai warrior with a glowing katana, wearing high-tech armor, standing in the rain, dramatic lighting, highly detailed character design" },
      { title: "أميرة خيالية", prompt: "A beautiful elven princess with silver hair, wearing an intricate elegant gown, standing in a magical garden, soft lighting, ethereal, fantasy portrait" },
      { title: "ساحر غامض", prompt: "A mysterious wizard casting a glowing spell, dark robes, glowing eyes, magical particles, highly detailed, fantasy concept art" }
    ]
  },
  {
    category: "أنمي (Anime)",
    prompts: [
      { title: "مشهد كلاسيكي", prompt: "Studio Ghibli style anime scenery, a cozy small bakery in a quiet Japanese town, warm sunlight, highly detailed, beautiful colors, nostalgic feeling" },
      { title: "شخصية قتالية", prompt: "Epic anime fight scene, a powerful hero with glowing aura, dynamic pose, shattered ground, intense action, colorful energy blasts, 4k" },
      { title: "فتاة الأنمي", prompt: "A beautiful anime girl with long flowing hair, wearing a school uniform, standing under a cherry blossom tree, petals falling, soft lighting, highly detailed" }
    ]
  },
  {
    category: "تصميم داخلي (Interior)",
    prompts: [
      { title: "غرفة معيشة حديثة", prompt: "A modern minimalist living room with large windows, natural light, cozy furniture, indoor plants, architectural photography, highly detailed" },
      { title: "مقهى دافئ", prompt: "A cozy rustic coffee shop interior, warm lighting, wooden furniture, espresso machine, people reading, highly detailed, photorealistic" }
    ]
  }
];

export default function ProjectWorkspace() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [prompt, setPrompt] = useState("");
  const [imageFiles, setImageFiles] = useState<string[]>([]);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Advanced Settings State
  const [aspectRatio, setAspectRatio] = useState("16:9");
  const [resolution, setResolution] = useState("1K");
  
  // Fullscreen State
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  // Cropping State
  const [imageToCrop, setImageToCrop] = useState<string | null>(null);
  const [crop, setCrop] = useState<CropType>({ unit: '%', x: 10, y: 10, width: 80, height: 80 });
  const [completedCrop, setCompletedCrop] = useState<any>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  // Loading Animation State
  const [progress, setProgress] = useState(0);
  const [loadingText, setLoadingText] = useState("تحليل الوصف...");

  // Upscale State
  const [isUpscaling, setIsUpscaling] = useState<string | null>(null);
  const [projectName, setProjectName] = useState<string>("");

  // Auth State
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(false);

  // Enhance Prompt State
  const [isEnhancingPrompt, setIsEnhancingPrompt] = useState(false);
  const [enhancedPromptResult, setEnhancedPromptResult] = useState<string | null>(null);

  // Prompt Bank State
  const [isPromptBankOpen, setIsPromptBankOpen] = useState(false);
  const [promptBank, setPromptBank] = useState<any[]>([]);
  const [isPromptBankEditMode, setIsPromptBankEditMode] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState<{catIdx: number, promptIdx: number, title: string, prompt: string} | null>(null);
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");

  // Template State
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [templateImage, setTemplateImage] = useState<string | null>(() => {
    try { return localStorage.getItem('xreef_template_image'); } catch { return null; }
  });
  const [templateSettings, setTemplateSettings] = useState(() => {
    try {
      const saved = localStorage.getItem('xreef_template_settings');
      return saved ? JSON.parse(saved) : { scale: 70, offsetX: 55, offsetY: 50 };
    } catch {
      return { scale: 70, offsetX: 55, offsetY: 50 };
    }
  });
  const [imageToTemplate, setImageToTemplate] = useState<string | null>(null);
  const templateCanvasRef = useRef<HTMLCanvasElement>(null);

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
      // Fetch History
      const historyRef = collection(db, `users/${user.uid}/projects/${projectId}/history`);
      const qHistory = query(historyRef, orderBy('timestamp', 'desc'));
      const unsubHistory = onSnapshot(qHistory, (snapshot) => {
        const historyData: HistoryItem[] = [];
        snapshot.forEach((doc) => {
          historyData.push(doc.data() as HistoryItem);
        });
        setHistory(historyData);
      }, (error) => {
        handleFirestoreError(error, OperationType.GET, `users/${user.uid}/projects/${projectId}/history`);
      });

      // Fetch Project Details
      const projectRef = doc(db, `users/${user.uid}/projects`, projectId!);
      const unsubProject = onSnapshot(projectRef, (docSnap) => {
        if (docSnap.exists()) {
          setProjectName(docSnap.data().name);
        }
      }, (error) => {
        handleFirestoreError(error, OperationType.GET, `users/${user.uid}/projects/${projectId}`);
      });

      // Fetch Prompt Bank
      const promptBankRef = collection(db, `users/${user.uid}/promptBank`);
      const unsubPromptBank = onSnapshot(promptBankRef, (snapshot) => {
        const bankData: any[] = [];
        snapshot.forEach((doc) => {
          bankData.push({ id: doc.id, ...doc.data() });
        });
        if (bankData.length > 0) {
          setPromptBank(bankData);
        } else {
          setPromptBank(DEFAULT_PROMPT_BANK);
          DEFAULT_PROMPT_BANK.forEach(async (cat, idx) => {
            try {
              const catId = `cat_${Date.now()}_${idx}`;
              await setDoc(doc(db, `users/${user.uid}/promptBank`, catId), {
                ...cat,
                userId: user.uid
              });
            } catch (err) {
               handleFirestoreError(err, OperationType.CREATE, `users/${user.uid}/promptBank`);
            }
          });
        }
      }, (error) => {
        handleFirestoreError(error, OperationType.GET, `users/${user.uid}/promptBank`);
      });

      return () => {
        unsubHistory();
        unsubProject();
        unsubPromptBank();
      };
    } else {
      try {
        const savedHistory = localStorage.getItem(`xreef_history_${projectId}`);
        setHistory(savedHistory ? JSON.parse(savedHistory) : []);
        const savedBank = localStorage.getItem('xreef_prompt_bank');
        setPromptBank(savedBank ? JSON.parse(savedBank) : DEFAULT_PROMPT_BANK);
      } catch (e) {
        setHistory([]);
        setPromptBank(DEFAULT_PROMPT_BANK);
      }
    }
  }, [user, isAuthReady, projectId]);

  useEffect(() => {
    localStorage.setItem('xreef_template_settings', JSON.stringify(templateSettings));
  }, [templateSettings]);

  const handleGoogleAuth = async () => {
    setIsAuthLoading(true);
    setAuthError(null);
    try {
      await signInWithGoogle();
      setIsAuthModalOpen(false);
    } catch (err: any) {
      if (err.code === 'auth/operation-not-allowed') {
        setAuthError("تسجيل الدخول بحساب Google غير مفعل في لوحة تحكم Firebase.");
      } else {
        setAuthError("حدث خطأ أثناء تسجيل الدخول بحساب Google.");
      }
    } finally {
      setIsAuthLoading(false);
    }
  };

  useEffect(() => {
    if (!isTemplateModalOpen || !templateImage || !imageToTemplate || !templateCanvasRef.current) return;

    const canvas = templateCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const tImg = new Image();
    tImg.crossOrigin = "anonymous";
    tImg.onload = () => {
      canvas.width = tImg.width;
      canvas.height = tImg.height;
      
      // Draw template
      ctx.drawImage(tImg, 0, 0);

      const gImg = new Image();
      gImg.crossOrigin = "anonymous";
      gImg.onload = () => {
        const targetWidth = (tImg.width * templateSettings.scale) / 100;
        const ratio = gImg.height / gImg.width;
        const targetHeight = targetWidth * ratio;

        const x = (tImg.width * templateSettings.offsetX) / 100 - (targetWidth / 2);
        const y = (tImg.height * templateSettings.offsetY) / 100 - (targetHeight / 2);

        ctx.drawImage(gImg, x, y, targetWidth, targetHeight);
      };
      gImg.src = imageToTemplate;
    };
    tImg.src = templateImage;

  }, [templateImage, imageToTemplate, templateSettings, isTemplateModalOpen]);

  const handleTemplateUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setTemplateImage(base64);
      try {
        localStorage.setItem('xreef_template_image', base64);
      } catch (err) {
        console.warn("Template image too large for localStorage");
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDownloadTemplate = () => {
    if (!templateCanvasRef.current) return;
    const dataUrl = templateCanvasRef.current.toDataURL('image/png');
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `xreef-template-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const openTemplateModal = (imageUrl: string) => {
    setImageToTemplate(imageUrl);
    setIsTemplateModalOpen(true);
  };

  const handleSavePrompt = async () => {
    if (!editingPrompt || !editingPrompt.title.trim() || !editingPrompt.prompt.trim()) return;
    const newBank = JSON.parse(JSON.stringify(promptBank));
    const cat = newBank[editingPrompt.catIdx];
    
    if (editingPrompt.promptIdx === -1) {
      cat.prompts.push({ title: editingPrompt.title, prompt: editingPrompt.prompt });
    } else {
      cat.prompts[editingPrompt.promptIdx] = { title: editingPrompt.title, prompt: editingPrompt.prompt };
    }
    
    if (user && cat.id) {
      try {
        await setDoc(doc(db, `users/${user.uid}/promptBank`, cat.id), {
          category: cat.category,
          prompts: cat.prompts,
          userId: user.uid
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}/promptBank`);
      }
    } else {
      setPromptBank(newBank);
      localStorage.setItem('xreef_prompt_bank', JSON.stringify(newBank));
    }
    setEditingPrompt(null);
  };

  const handleDeletePrompt = async (catIdx: number, promptIdx: number) => {
    const newBank = JSON.parse(JSON.stringify(promptBank));
    const cat = newBank[catIdx];
    cat.prompts.splice(promptIdx, 1);
    
    if (user && cat.id) {
      try {
        await setDoc(doc(db, `users/${user.uid}/promptBank`, cat.id), {
          category: cat.category,
          prompts: cat.prompts,
          userId: user.uid
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}/promptBank`);
      }
    } else {
      setPromptBank(newBank);
      localStorage.setItem('xreef_prompt_bank', JSON.stringify(newBank));
    }
  };

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) return;
    
    if (user) {
      try {
        const catId = `cat_${Date.now()}`;
        await setDoc(doc(db, `users/${user.uid}/promptBank`, catId), {
          category: newCategoryName,
          prompts: [],
          userId: user.uid
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `users/${user.uid}/promptBank`);
      }
    } else {
      const newBank = [...promptBank, { category: newCategoryName, prompts: [] }];
      setPromptBank(newBank);
      localStorage.setItem('xreef_prompt_bank', JSON.stringify(newBank));
    }
    setNewCategoryName("");
    setIsAddingCategory(false);
  };

  const handleDeleteCategory = async (catIdx: number) => {
    const cat = promptBank[catIdx];
    
    if (user && cat.id) {
      try {
        await deleteDoc(doc(db, `users/${user.uid}/promptBank`, cat.id));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `users/${user.uid}/promptBank`);
      }
    } else {
      const newBank = JSON.parse(JSON.stringify(promptBank));
      newBank.splice(catIdx, 1);
      setPromptBank(newBank);
      localStorage.setItem('xreef_prompt_bank', JSON.stringify(newBank));
    }
  };

  const handleEnhancePrompt = async () => {
    if (!prompt.trim()) return;
    setIsEnhancingPrompt(true);
    setError(null);
    setEnhancedPromptResult(null);

    try {
      const response = await fetch('/api/translate-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          prompt: prompt.trim(),
          image: imageFiles.length > 0 ? imageFiles[0] : null
        }),
      });
      let data;
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        data = await response.json();
      } else {
        const text = await response.text();
        console.error("Non-JSON response:", text);
        if (text.includes("Please wait while your application starts") || text.includes("application is starting")) {
          throw new Error("الخادم قيد التشغيل حالياً. يرجى الانتظار بضع ثوانٍ والمحاولة مرة أخرى.");
        }
        if (response.status === 405) {
          throw new Error("حدث خطأ في الاتصال بالخادم (405). يرجى تحديث الصفحة والمحاولة مرة أخرى.");
        }
        throw new Error(`الخادم لم يرجع استجابة صحيحة. رمز الخطأ: ${response.status}`);
      }

      if (!response.ok) {
        throw new Error(data.error || 'Failed to enhance prompt');
      }
      setEnhancedPromptResult(data.enhancedPrompt);
    } catch (err: any) {
      console.error("Enhance prompt error:", err);
      if (err.name === 'TypeError' && err.message === 'Failed to fetch') {
        setError("فشل الاتصال بالخادم. قد يكون الطلب كبيراً جداً (حجم الصورة) أو أن هناك مشكلة في الشبكة.");
      } else {
        setError(err.message || "حدث خطأ أثناء ترجمة الوصف");
      }
    } finally {
      setIsEnhancingPrompt(false);
    }
  };

  useEffect(() => {
    if (!isLoading) {
      setProgress(0);
      return;
    }

    const duration = 12000; // 12 seconds simulated
    const interval = 100;
    const steps = duration / interval;
    let currentStep = 0;

    const timer = setInterval(() => {
      currentStep++;
      // Easing function for progress (starts fast, slows down)
      const rawProgress = currentStep / steps;
      const easedProgress = 1 - Math.pow(1 - rawProgress, 3); // Cubic ease out
      
      const currentProgress = Math.min(99, Math.floor(easedProgress * 100));
      setProgress(currentProgress);

      if (currentProgress < 25) setLoadingText("تحليل الوصف وبناء المشهد...");
      else if (currentProgress < 50) setLoadingText("توليد التكوين الأساسي...");
      else if (currentProgress < 75) setLoadingText("إضافة التفاصيل والألوان...");
      else setLoadingText("اللمسات الأخيرة وتحسين الجودة...");

    }, interval);

    return () => clearInterval(timer);
  }, [isLoading]);

  // History State
  const [history, setHistory] = useState<HistoryItem[]>([]);

  const addToHistory = async (urls: string[], currentPrompt: string) => {
    const newItems = urls.map(url => ({
      id: Math.random().toString(36).substring(2, 9),
      url,
      prompt: currentPrompt,
      timestamp: Date.now()
    }));
    
    if (user) {
      for (const item of newItems) {
        try {
          await setDoc(doc(db, `users/${user.uid}/projects/${projectId}/history`, item.id), {
            ...item,
            userId: user.uid
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, `users/${user.uid}/projects/${projectId}/history`);
        }
      }
    } else {
      setHistory(prev => {
        const next = [...newItems, ...prev].slice(0, 50);
        localStorage.setItem(`xreef_history_${projectId}`, JSON.stringify(next));
        return next;
      });
    }
  };

  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 1024;
          const MAX_HEIGHT = 1024;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error("Could not get canvas context"));
            return;
          }
          ctx.drawImage(img, 0, 0, width, height);
          
          // Export as JPEG with 80% quality to drastically reduce size
          const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
          resolve(dataUrl);
        };
        img.onerror = (error) => reject(error);
      };
      reader.onerror = (error) => reject(error);
    });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      try {
        const compressedBase64 = await compressImage(files[0]);
        setImageFiles([compressedBase64]);
        setError(null);
      } catch (err) {
        console.error("Error compressing image:", err);
        setError("حدث خطأ أثناء معالجة الصورة.");
      }
    }
  };

  const removeImage = (index: number) => {
    setImageFiles(prev => prev.filter((_, i) => i !== index));
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;

    setIsLoading(true);
    setError(null);
    setImageUrls([]);

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ 
          prompt: prompt.trim(), 
          images: imageFiles,
          aspectRatio,
          resolution,
          model: "google/nano-banana-pro"
        }),
      });

      let data;
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        data = await response.json();
      } else {
        const text = await response.text();
        if (text.includes("Please wait while your application starts") || text.includes("application is starting")) {
          throw new Error("الخادم قيد التشغيل حالياً. يرجى الانتظار بضع ثوانٍ والمحاولة مرة أخرى.");
        }
        throw new Error(`الخادم لم يرجع استجابة صحيحة. رمز الخطأ: ${response.status}`);
      }

      if (!response.ok) {
        throw new Error(data.error || "حدث خطأ أثناء توليد الصورة");
      }

      if (data.outputs && Array.isArray(data.outputs)) {
        setImageUrls(data.outputs);
        addToHistory(data.outputs, prompt);
      } else if (typeof data.output === "string") {
        setImageUrls([data.output]);
        addToHistory([data.output], prompt);
      } else if (Array.isArray(data.output) && data.output.length > 0) {
        setImageUrls([data.output[0]]);
        addToHistory([data.output[0]], prompt);
      } else if (data.output && typeof data.output === "object" && data.output.url) {
        setImageUrls([data.output.url]);
        addToHistory([data.output.url], prompt);
      } else {
        console.error("Unexpected output format:", data.output);
        throw new Error(`تنسيق الاستجابة غير متوقع: ${JSON.stringify(data.output)}`);
      }
    } catch (err: any) {
      console.error(err);
      let msg = err.message || "حدث خطأ أثناء توليد الصورة";
      if (msg.includes("Prediction failed")) {
        msg = "فشل توليد الصورة. قد يكون السبب هو سياسة الأمان أو مشكلة مؤقتة في الخادم. حاول تغيير الوصف أو المحاولة لاحقاً.";
      }
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = async (urlToDownload: string) => {
    if (!urlToDownload) return;
    try {
      // Fetch the image as a blob to force download instead of opening in new tab
      const response = await fetch(urlToDownload);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `XREEF-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Error downloading image:", err);
      // Fallback: open in new tab
      window.open(urlToDownload, '_blank');
    }
  };

  const handleUpscale = async (urlToUpscale: string) => {
    if (!urlToUpscale) return;
    setIsUpscaling(urlToUpscale);
    try {
      const response = await fetch("/api/upscale", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ 
          image: urlToUpscale,
          scale: 4,
          faceEnhance: false
        }),
      });

      let data;
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        data = await response.json();
      } else {
        const text = await response.text();
        if (text.includes("Please wait while your application starts") || text.includes("application is starting")) {
          throw new Error("الخادم قيد التشغيل حالياً. يرجى الانتظار بضع ثوانٍ والمحاولة مرة أخرى.");
        }
        throw new Error(`الخادم لم يرجع استجابة صحيحة. رمز الخطأ: ${response.status}, النوع: ${contentType}`);
      }

      if (!response.ok) {
        throw new Error(data.error || "حدث خطأ أثناء تكبير الصورة");
      }

      if (data.output) {
        // Replace the image in the current results if it's there
        setImageUrls(prev => prev.map(url => url === urlToUpscale ? data.output : url));
        
        // Replace in history
        if (user) {
          const itemToUpdate = history.find(item => item.url === urlToUpscale);
          if (itemToUpdate) {
            try {
              await setDoc(doc(db, `users/${user.uid}/projects/${projectId}/history`, itemToUpdate.id), {
                ...itemToUpdate,
                url: data.output
              });
            } catch (err) {
              handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}/projects/${projectId}/history`);
            }
          }
        } else {
          setHistory(prev => {
            const next = prev.map(item => 
              item.url === urlToUpscale ? { ...item, url: data.output } : item
            );
            localStorage.setItem(`xreef_history_${projectId}`, JSON.stringify(next));
            return next;
          });
        }

        // If it's the currently selected image, update it
        if (selectedImage === urlToUpscale) {
          setSelectedImage(data.output);
        }
      }
    } catch (err: any) {
      console.error("Error upscaling image:", err);
      alert(err.message || "حدث خطأ أثناء تكبير الصورة");
    } finally {
      setIsUpscaling(null);
    }
  };

  const handleUseAsInput = (url: string) => {
    setImageFiles(prev => [...prev, url].slice(0, 14));
    setSelectedImage(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const openCropModal = async (url: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      setImageToCrop(blobUrl);
      setCrop({ unit: '%', x: 10, y: 10, width: 80, height: 80 });
      setCompletedCrop(null);
    } catch (err) {
      console.error("Error loading image for crop:", err);
      setImageToCrop(url);
    }
  };

  const closeCropModal = () => {
    if (imageToCrop && imageToCrop.startsWith('blob:')) {
      window.URL.revokeObjectURL(imageToCrop);
    }
    setImageToCrop(null);
  };

  const handleSaveCrop = async () => {
    if (!completedCrop || !imgRef.current || completedCrop.width === 0 || completedCrop.height === 0) {
      return;
    }

    const image = imgRef.current;
    const canvas = document.createElement('canvas');
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;
    
    canvas.width = completedCrop.width * scaleX;
    canvas.height = completedCrop.height * scaleY;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(
      image,
      completedCrop.x * scaleX,
      completedCrop.y * scaleY,
      completedCrop.width * scaleX,
      completedCrop.height * scaleY,
      0,
      0,
      completedCrop.width * scaleX,
      completedCrop.height * scaleY
    );

    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `XREEF-Cropped-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      closeCropModal();
    }, 'image/png');
  };

  if (!isAuthReady) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="h-screen w-full bg-[#0a0a0a] text-neutral-200 flex flex-col font-sans overflow-hidden selection:bg-blue-500/30" dir="rtl">
      {/* SVG Filters & Utilities */}
      <style>{`
        .bg-dot-pattern {
          background-image: radial-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 1px);
          background-size: 24px 24px;
        }
        @keyframes scan {
          0% { top: 0%; opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { top: 100%; opacity: 0; }
        }
        .animate-scan {
          animation: scan 2.5s linear infinite;
        }
        @keyframes shimmer {
          0% { background-position: 20px 0; }
          100% { background-position: 0 0; }
        }
      `}</style>

      {/* Auth Modal */}
      {isAuthModalOpen && !user && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4" onClick={() => setIsAuthModalOpen(false)}>
          <div 
            className="bg-[#111] border border-white/10 p-8 rounded-3xl shadow-2xl max-w-md w-full relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button 
              onClick={() => setIsAuthModalOpen(false)}
              className="absolute top-4 right-4 text-neutral-500 hover:text-white bg-white/5 hover:bg-white/10 rounded-full p-2 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="flex justify-center mb-6 mt-2">
              <Scene3D className="h-[200px]" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2 text-center tracking-tight">مرحباً بك في Xreef</h2>
            <p className="text-neutral-400 text-center mb-8 text-sm">قم بتسجيل الدخول لحفظ مشاريعك وسجل توليدك</p>

            {authError && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-3 rounded-xl mb-6 text-sm flex items-center gap-2">
                <X className="w-4 h-4 shrink-0" />
                <span>{authError}</span>
              </div>
            )}

            <button 
              onClick={handleGoogleAuth} 
              disabled={isAuthLoading}
              className="w-full bg-white hover:bg-neutral-200 text-black font-bold py-3.5 rounded-xl transition-all flex justify-center items-center gap-3 shadow-lg hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
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
      )}

      {/* Fullscreen Image Modal */}
      {selectedImage && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/95 backdrop-blur-lg p-4 sm:p-8" onClick={() => setSelectedImage(null)}>
          <button className="absolute top-6 right-6 text-white/50 hover:text-white bg-white/10 hover:bg-white/20 rounded-full p-3 transition-all backdrop-blur-md" onClick={() => setSelectedImage(null)}>
            <X className="w-6 h-6" />
          </button>
          <img src={selectedImage} alt="عرض" className="max-w-full max-h-full object-contain rounded-xl shadow-2xl" onClick={(e) => e.stopPropagation()} />
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-3 flex-wrap justify-center w-full px-4" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => handleUseAsInput(selectedImage)} className="flex items-center gap-2 bg-neutral-900/80 hover:bg-neutral-800 text-white px-5 py-3 rounded-full font-medium transition-all shadow-xl border border-white/10 backdrop-blur-md">
               <ImagePlus className="w-4 h-4" /> كمرجع
            </button>
            <button onClick={() => handleUpscale(selectedImage)} disabled={isUpscaling === selectedImage} className="flex items-center gap-2 bg-neutral-900/80 hover:bg-neutral-800 text-white px-5 py-3 rounded-full font-medium transition-all shadow-xl border border-white/10 backdrop-blur-md disabled:opacity-50">
               {isUpscaling === selectedImage ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
               تكبير الدقة
            </button>
            <button onClick={() => { setSelectedImage(null); openCropModal(selectedImage); }} className="flex items-center gap-2 bg-neutral-900/80 hover:bg-neutral-800 text-white px-5 py-3 rounded-full font-medium transition-all shadow-xl border border-white/10 backdrop-blur-md">
               <Crop className="w-4 h-4" /> قص
            </button>
            <button onClick={() => handleDownload(selectedImage)} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-full font-medium transition-all shadow-xl border border-blue-500/50 backdrop-blur-md">
               <Download className="w-5 h-5" /> تنزيل
            </button>
          </div>
        </div>
      )}

      {/* Cropping Modal */}
      {imageToCrop && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/95 backdrop-blur-md p-4 sm:p-8">
          <button className="absolute top-6 right-6 text-white/50 hover:text-white bg-white/10 rounded-full p-3 transition-all z-10" onClick={closeCropModal}>
            <X className="w-6 h-6" />
          </button>
          <div className="flex flex-col items-center justify-center max-h-full max-w-full w-full">
            <h3 className="text-white text-xl font-bold mb-6 tracking-tight">قص وتعديل الصورة</h3>
            <div className="overflow-auto max-h-[65vh] max-w-full bg-neutral-900/50 rounded-2xl border border-white/10 p-2 shadow-2xl">
              <ReactCrop crop={crop} onChange={(_, percentCrop) => setCrop(percentCrop)} onComplete={(c) => setCompletedCrop(c)}>
                <img ref={imgRef} src={imageToCrop} alt="قص الصورة" className="max-h-[60vh] w-auto object-contain rounded-xl" />
              </ReactCrop>
            </div>
            <div className="mt-8 flex gap-3">
              <button onClick={closeCropModal} className="px-6 py-2.5 rounded-xl font-medium text-white bg-neutral-800 hover:bg-neutral-700 transition-all border border-white/10">إلغاء</button>
              <button onClick={handleSaveCrop} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-6 py-2.5 rounded-xl font-medium transition-all shadow-lg">
                <Download className="w-4 h-4" /> حفظ الصورة المخصوصة
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Prompt Bank Modal */}
      {isPromptBankOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 sm:p-8" onClick={() => setIsPromptBankOpen(false)}>
          <div className="bg-[#111] border border-white/10 rounded-3xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-white/5 bg-white/[0.02]">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
                  <Library className="w-5 h-5 text-blue-400" />
                </div>
                <h3 className="text-xl font-bold text-white tracking-tight">مكتبة الأوصاف</h3>
                <button onClick={() => setIsPromptBankEditMode(!isPromptBankEditMode)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ml-4 ${isPromptBankEditMode ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30' : 'bg-white/5 text-neutral-400 hover:text-white border border-transparent'}`}>
                  <Edit2 className="w-3.5 h-3.5" />
                  {isPromptBankEditMode ? 'إنهاء التعديل' : 'تعديل المكتبة'}
                </button>
              </div>
              <button onClick={() => setIsPromptBankOpen(false)} className="text-neutral-500 hover:text-white bg-white/5 rounded-full p-2 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="overflow-y-auto p-6 space-y-10 custom-scrollbar relative">
              {promptBank.map((category, idx) => (
                <div key={idx} className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-base font-semibold text-neutral-300 flex items-center gap-2">
                       <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                       {category.category}
                    </h4>
                    {isPromptBankEditMode && (
                      <button onClick={() => handleDeleteCategory(idx)} className="text-red-400 hover:text-red-300 p-1.5 rounded-lg hover:bg-red-500/10 transition-colors" title="حذف التصنيف">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {category.prompts.map((p, pIdx) => (
                      <div key={pIdx} className="relative group flex flex-col h-full">
                        <button onClick={() => { if (!isPromptBankEditMode) { setPrompt(p.prompt); setIsPromptBankOpen(false); } }} className={`flex flex-col items-start text-right p-4 rounded-2xl bg-neutral-900 border transition-all h-full ${isPromptBankEditMode ? 'border-white/5 cursor-default' : 'hover:bg-neutral-800 border-white/5 hover:border-blue-500/30 cursor-pointer'}`}>
                          <span className="font-semibold text-sm text-neutral-200 group-hover:text-blue-300 mb-2 pr-6">{p.title}</span>
                          <span className="text-[11px] text-neutral-500 line-clamp-3 leading-relaxed" dir="ltr">{p.prompt}</span>
                        </button>
                        {isPromptBankEditMode && (
                          <div className="absolute top-3 right-3 flex items-center gap-1 bg-neutral-900 rounded-lg p-1 border border-white/5 shadow-lg">
                            <button onClick={(e) => { e.stopPropagation(); setEditingPrompt({ catIdx: idx, promptIdx: pIdx, title: p.title, prompt: p.prompt }); }} className="p-1 text-neutral-400 hover:text-blue-400 transition-colors">
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); handleDeletePrompt(idx, pIdx); }} className="p-1 text-neutral-400 hover:text-red-400 transition-colors">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                    {isPromptBankEditMode && (
                      <button onClick={() => setEditingPrompt({ catIdx: idx, promptIdx: -1, title: "", prompt: "" })} className="flex flex-col items-center justify-center text-center p-4 rounded-2xl bg-neutral-900/50 hover:bg-neutral-800 border border-dashed border-white/10 hover:border-blue-500/30 transition-all text-neutral-500 hover:text-blue-400 min-h-[100px]">
                        <Plus className="w-5 h-5 mb-1" />
                        <span className="text-[11px] font-medium">إضافة نص</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
              
              {isPromptBankEditMode && (
                <div className="pt-8 border-t border-white/5">
                  {isAddingCategory ? (
                    <div className="flex items-center gap-3 bg-neutral-900 p-3 rounded-2xl border border-white/10">
                      <input type="text" value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} placeholder="اسم القسم الجديد..." className="flex-1 bg-transparent border-none text-white focus:outline-none text-sm px-2" autoFocus />
                      <button onClick={handleAddCategory} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-1.5 rounded-xl text-sm font-medium transition-colors">إضافة</button>
                      <button onClick={() => { setIsAddingCategory(false); setNewCategoryName(""); }} className="bg-neutral-800 hover:bg-neutral-700 text-white px-4 py-1.5 rounded-xl text-sm font-medium transition-colors">إلغاء</button>
                    </div>
                  ) : (
                    <button onClick={() => setIsAddingCategory(true)} className="flex items-center justify-center gap-2 w-full p-4 rounded-2xl bg-neutral-900/50 hover:bg-neutral-800 border border-dashed border-white/10 hover:border-blue-500/30 transition-all text-neutral-500 hover:text-blue-400">
                      <Plus className="w-5 h-5" />
                      <span className="text-sm font-medium">إضافة قسم جديد</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Edit Prompt Modal inside Prompt Bank */}
      {editingPrompt && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 backdrop-blur-md p-4" onClick={() => setEditingPrompt(null)}>
          <div className="bg-[#111] border border-white/10 rounded-3xl shadow-2xl w-full max-w-lg p-6 space-y-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-xl font-bold text-white flex items-center gap-2 pb-4 border-b border-white/5">
              <Edit2 className="w-5 h-5 text-blue-400" />
              {editingPrompt.promptIdx === -1 ? 'إضافة نص للمكتبة' : 'تعديل النص'}
            </h3>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="block text-xs font-medium text-neutral-400">عنوان موجز</label>
                <input type="text" value={editingPrompt.title} onChange={(e) => setEditingPrompt({...editingPrompt, title: e.target.value})} placeholder="مثال: غابة سحرية" className="w-full bg-neutral-900 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50" />
              </div>
              <div className="space-y-2">
                <label className="block text-xs font-medium text-neutral-400">النص الكامل (Prompt)</label>
                <textarea value={editingPrompt.prompt} onChange={(e) => setEditingPrompt({...editingPrompt, prompt: e.target.value})} placeholder="أدخل النص التفصيلي باللغة الإنجليزية..." rows={5} className="w-full bg-neutral-900 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 resize-none custom-scrollbar" dir="ltr" />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/5">
              <button onClick={() => setEditingPrompt(null)} className="px-5 py-2.5 rounded-xl text-neutral-400 hover:text-white hover:bg-white/5 text-sm font-medium transition-colors">إلغاء</button>
              <button onClick={handleSavePrompt} disabled={!editingPrompt.title.trim() || !editingPrompt.prompt.trim()} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-6 py-2.5 rounded-xl text-sm font-medium transition-colors">
                <Save className="w-4 h-4" /> حفظ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Template Modal */}
      {isTemplateModalOpen && imageToTemplate && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/90 backdrop-blur-md p-4" onClick={() => setIsTemplateModalOpen(false)}>
          <div className="bg-[#111] border border-white/10 rounded-3xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-white/5 bg-white/[0.02]">
              <h3 className="text-xl font-bold text-white flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center text-indigo-400"><LayoutTemplate className="w-4 h-4" /></div>
                دمج مع قالب
              </h3>
              <button onClick={() => setIsTemplateModalOpen(false)} className="text-neutral-500 hover:text-white bg-white/5 rounded-full p-2.5 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
               <div className="flex-1 p-6 bg-black overflow-auto flex items-center justify-center relative dot-pattern">
                 {!templateImage ? (
                   <div className="text-center space-y-4">
                     <div className="w-20 h-20 bg-neutral-900 rounded-full flex items-center justify-center mx-auto border border-dashed border-neutral-700">
                       <Upload className="w-8 h-8 text-neutral-500" />
                     </div>
                     <p className="text-sm text-neutral-400">الرجاء رفع صورة القالب (الموك آب)</p>
                     <input type="file" accept="image/*" onChange={handleTemplateUpload} className="hidden" id="template-upload" />
                     <label htmlFor="template-upload" className="inline-block bg-white/10 hover:bg-white/20 text-white px-5 py-2.5 rounded-xl text-sm font-medium cursor-pointer transition-colors border border-white/10">اختيار صورة القالب</label>
                   </div>
                 ) : (
                   <div className="relative shadow-2xl border border-white/10 rounded-xl overflow-hidden bg-neutral-900" style={{ maxWidth: '100%', maxHeight: '100%' }}>
                     <canvas ref={templateCanvasRef} className="max-w-full max-h-[60vh] md:max-h-[70vh] object-contain" />
                   </div>
                 )}
               </div>
               {templateImage && (
                 <div className="w-full md:w-80 p-6 border-t md:border-t-0 md:border-r border-white/5 bg-[#0a0a0a] overflow-y-auto space-y-8 custom-scrollbar">
                   <div className="space-y-6">
                     <h4 className="text-sm font-semibold text-neutral-300 flex items-center gap-2">
                       <Settings2 className="w-4 h-4" /> إعدادات الدمج
                     </h4>
                     <div className="space-y-3">
                       <label className="flex justify-between text-xs font-medium text-neutral-400"><span>مقياس الحجم (Scale)</span><span className="text-indigo-400">{templateSettings.scale}%</span></label>
                       <input type="range" min="10" max="200" value={templateSettings.scale} onChange={(e) => setTemplateSettings({...templateSettings, scale: parseInt(e.target.value)})} className="w-full h-1 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-indigo-500" />
                     </div>
                     <div className="space-y-3">
                       <label className="flex justify-between text-xs font-medium text-neutral-400"><span>المحور الأفقي (X)</span><span className="text-indigo-400">{templateSettings.offsetX}%</span></label>
                       <input type="range" min="0" max="100" value={templateSettings.offsetX} onChange={(e) => setTemplateSettings({...templateSettings, offsetX: parseInt(e.target.value)})} className="w-full h-1 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-indigo-500" />
                     </div>
                     <div className="space-y-3">
                       <label className="flex justify-between text-xs font-medium text-neutral-400"><span>المحور الرأسي (Y)</span><span className="text-indigo-400">{templateSettings.offsetY}%</span></label>
                       <input type="range" min="0" max="100" value={templateSettings.offsetY} onChange={(e) => setTemplateSettings({...templateSettings, offsetY: parseInt(e.target.value)})} className="w-full h-1 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-indigo-500" />
                     </div>
                   </div>
                   <div className="pt-6 border-t border-white/5 space-y-3">
                     <button onClick={handleDownloadTemplate} className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-3 rounded-xl text-sm font-bold transition-colors shadow-lg shadow-indigo-500/20">
                       <Download className="w-4 h-4" /> حفظ النتيجة
                     </button>
                     <div className="text-center">
                       <input type="file" accept="image/*" onChange={handleTemplateUpload} className="hidden" id="template-change" />
                       <label htmlFor="template-change" className="text-xs text-neutral-500 hover:text-white cursor-pointer transition-colors block py-2">تغيير صورة القالب</label>
                     </div>
                   </div>
                 </div>
               )}
            </div>
          </div>
        </div>
      )}

      {/* --- Main App Layout --- */}

      {/* Top Navbar */}
      <header className="h-16 flex-none border-b border-white/5 bg-[#0a0a0a] flex items-center justify-between px-4 sm:px-6 z-20">
        <div className="flex items-center gap-4 sm:gap-6">
          <button onClick={() => navigate('/')} className="text-neutral-500 hover:text-white hover:bg-white/5 p-2 rounded-lg transition-all" title="الرجوع للقائمة">
            <ArrowLeft size={18} />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div className="flex flex-col">
              <h1 className="font-bold text-base sm:text-lg leading-tight text-white tracking-wide">Xreef <span className="text-blue-400">1.7</span></h1>
            </div>
          </div>
          {projectName && (
            <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-white/5 rounded-full border border-white/5 ml-4">
              <Folder className="w-3.5 h-3.5 text-neutral-400" />
              <span className="text-xs font-medium text-neutral-300">{projectName}</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 sm:gap-4">
          <button onClick={() => navigate('/support')} className="text-neutral-500 hover:text-white hover:bg-white/5 p-2 rounded-lg transition-all hidden sm:block" title="الدعم الفني">
            <LifeBuoy size={18} />
          </button>
          
          <div className="w-px h-6 bg-white/10 hidden sm:block"></div>

          {user ? (
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex items-center gap-2 bg-neutral-900 border border-white/5 px-2 py-1 rounded-full pr-1">
                <span className="text-xs font-medium text-neutral-300 pl-2">{user.displayName || 'مستخدم'}</span>
                {user.photoURL ? (
                  <img src={user.photoURL} alt="المستخدم" className="w-6 h-6 rounded-full border border-white/10" />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center border border-blue-500/30">
                    <span className="text-xs text-blue-400">{user.displayName?.charAt(0) || 'U'}</span>
                  </div>
                )}
              </div>
              <button onClick={logOut} className="text-red-400/80 hover:text-red-400 bg-red-500/10 hover:bg-red-500/20 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors" title="تسجيل الخروج">
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button onClick={() => { setAuthError(null); setIsAuthModalOpen(true); }} className="flex items-center gap-2 bg-white hover:bg-neutral-200 text-black px-4 py-1.5 rounded-lg text-sm font-bold transition-all shadow-lg text-center">
              <LogIn className="w-4 h-4 hidden sm:block" />
              تسجيل دخول
            </button>
          )}
        </div>
      </header>

      <main className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
        
        {/* Right Sidebar (Controls) */}
        <aside className="w-full md:w-[380px] lg:w-[420px] flex-none border-l border-white/5 bg-[#0a0a0a] flex flex-col z-10 md:h-full order-2 md:order-1 relative">
          <div className="flex-1 overflow-y-auto p-5 sm:p-6 custom-scrollbar">
            <form onSubmit={handleGenerate} className="space-y-8 pb-32 md:pb-0 relative h-full flex flex-col">
              
              {/* Prompt Section */}
              <div className="space-y-3 shrink-0">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-bold text-neutral-200 flex items-center gap-2">
                     <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                     وصف الصورة
                  </label>
                  <button type="button" onClick={() => setIsPromptBankOpen(true)} className="text-[11px] font-medium text-blue-400 hover:text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 px-2.5 py-1.5 rounded-md transition-colors flex items-center gap-1.5">
                    <Library className="w-3.5 h-3.5" /> الأوصاف الجاهزة
                  </button>
                </div>
                
                <div className="relative group">
                  <textarea
                    id="prompt"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    disabled={isLoading || isEnhancingPrompt}
                    placeholder="ماذا تريد أن تبدع اليوم؟ (بالعربية أو الإنجليزية)..."
                    className="w-full bg-[#141414] border border-white/10 text-white rounded-2xl p-4 min-h-[140px] resize-none focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all custom-scrollbar text-sm leading-relaxed"
                  />
                  <div className="absolute left-3 bottom-3 flex items-center gap-2">
                    <button type="button" onClick={handleEnhancePrompt} disabled={!prompt.trim() || isEnhancingPrompt || isLoading} className="flex items-center justify-center w-8 h-8 rounded-full bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border border-purple-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed group/magic" title="ترجمة وتحسين الوصف بواسطة Gemini 3.1">
                      {isEnhancingPrompt ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4 group-hover/magic:scale-110 transition-transform" />}
                    </button>
                    {prompt.trim() && (
                      <button type="button" onClick={() => setPrompt('')} className="flex items-center justify-center w-8 h-8 rounded-full bg-neutral-800 hover:bg-neutral-700 text-neutral-400 transition-all border border-white/5" title="مسح النص">
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {enhancedPromptResult && (
                  <div className="p-4 bg-purple-900/10 border border-purple-500/20 rounded-2xl animate-in slide-in-from-top-2">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-bold text-purple-400 uppercase tracking-widest">Gemini 3.1 ✧</span>
                      <button type="button" onClick={() => setEnhancedPromptResult(null)} className="text-neutral-500 hover:text-white transition-colors"><X className="w-3.5 h-3.5"/></button>
                    </div>
                    <p className="text-xs text-purple-200/80 leading-relaxed mb-3 font-mono" dir="ltr">{enhancedPromptResult}</p>
                    <button type="button" onClick={() => { setPrompt(enhancedPromptResult); setEnhancedPromptResult(null); }} className="w-full py-2 bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 rounded-xl text-xs font-medium transition-colors border border-purple-500/20">
                      استخدام هذا الوصف
                    </button>
                  </div>
                )}
              </div>

              {/* Reference Image Section */}
              <div className="space-y-3 shrink-0">
                <label className="text-sm font-bold text-neutral-200 flex items-center gap-2">
                   <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                   صورة مرجعية <span className="text-neutral-600 font-normal text-xs">(اختياري)</span>
                </label>
                {imageFiles.length > 0 ? (
                  <div className="relative group w-full aspect-video bg-[#141414] rounded-2xl border border-indigo-500/30 overflow-hidden flex items-center justify-center">
                    <img src={imageFiles[0]} alt="معاينة" className="w-full h-full object-contain" />
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <button type="button" onClick={() => removeImage(0)} className="bg-red-500/90 text-white p-2.5 rounded-full hover:bg-red-500 hover:scale-110 active:scale-95 transition-all shadow-lg shadow-red-500/20">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div onClick={() => fileInputRef.current?.click()} className="flex flex-col items-center justify-center w-full min-h-[100px] border border-dashed border-white/10 hover:border-indigo-500/50 bg-[#141414] hover:bg-[#1a1a1a] rounded-2xl cursor-pointer transition-all group p-4">
                    <Upload className="w-6 h-6 text-neutral-600 group-hover:text-indigo-400 transition-colors mb-2" />
                    <span className="text-xs text-neutral-500 font-medium">سحب وإفلات أو اضغط لرفع صورة</span>
                  </div>
                )}
                <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/*" className="hidden" />
              </div>

              {/* Settings Section */}
              <div className="grid grid-cols-2 gap-4 shrink-0">
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">الأبعاد (Ratio)</label>
                  <div className="relative">
                    <select value={aspectRatio} onChange={(e) => setAspectRatio(e.target.value)} className="w-full appearance-none bg-[#141414] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500/50 transition-colors">
                      <option value="1:1">مربع 1:1</option>
                      <option value="16:9">شاشة 16:9</option>
                      <option value="9:16">طولي 9:16</option>
                      <option value="4:3">أفقي 4:3</option>
                      <option value="3:4">عمودي 3:4</option>
                    </select>
                    <ChevronDown className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500 pointer-events-none" />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">الدقة (Res)</label>
                  <div className="relative">
                    <select value={resolution} onChange={(e) => setResolution(e.target.value)} className="w-full appearance-none bg-[#141414] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500/50 transition-colors">
                      <option value="1K">سريع 1K</option>
                      <option value="2K">عالي 2K</option>
                      <option value="4K">فائق 4K</option>
                    </select>
                    <ChevronDown className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500 pointer-events-none" />
                  </div>
                </div>
              </div>

              {/* Error Box inside scroll area */}
              {error && (
                <div className="p-4 bg-red-900/10 border border-red-500/20 rounded-xl flex items-start gap-3 mt-4 shrink-0">
                  <div className="w-8 h-8 rounded-full bg-red-500/10 flex items-center justify-center shrink-0 border border-red-500/20"><X className="w-4 h-4 text-red-500" /></div>
                  <p className="text-xs text-red-400 leading-relaxed pt-1">{error}</p>
                </div>
              )}

              {/* Spacer so generate button doesn't cover content on mobile */}
              <div className="h-4 md:hidden shrink-0"></div>

              {/* Generate Button Wrapper - Sticky on mobile, normal flex on desktop */}
              <div className="absolute md:relative bottom-0 left-0 right-0 p-5 md:p-0 bg-[#0a0a0a] md:bg-transparent border-t border-white/5 md:border-none z-20 mt-auto pt-6">
                <button
                  type="submit"
                  disabled={isLoading || !prompt.trim()}
                  className={`w-full relative overflow-hidden flex items-center justify-center gap-3 py-4 rounded-2xl font-bold text-sm transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed ${
                    isLoading 
                      ? 'bg-neutral-800 text-neutral-400 border border-white/5' 
                      : 'bg-white text-black hover:bg-neutral-200 shadow-[0_0_40px_-10px_rgba(255,255,255,0.3)] hover:shadow-[0_0_60px_-15px_rgba(255,255,255,0.5)] active:scale-[0.98]'
                  }`}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>قيد التنفيذ...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5" />
                      <span>توليد إبداع جديد</span>
                    </>
                  )}
                </button>
              </div>

            </form>
          </div>
        </aside>

        {/* Left Area (Canvas) */}
        <section className="flex-1 flex flex-col relative bg-[#111] overflow-hidden order-1 md:order-2">
           {/* Subtle Grid Background */}
           <div className="absolute inset-0 bg-dot-pattern opacity-50 z-0 mix-blend-overlay"></div>
           <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(0,0,0,0)_0%,rgba(10,10,10,1)_90%)] z-0 pointer-events-none"></div>

           {/* Canvas Area */}
           <div className="flex-1 overflow-x-hidden overflow-y-auto custom-scrollbar p-6 lg:p-10 relative z-10 flex flex-col">
              
              {isLoading ? (
                <div className="m-auto flex flex-col items-center justify-center p-8 max-w-sm w-full">
                  <div className="relative w-32 h-32 mb-8">
                     {/* Cybernetic loading ring */}
                     <div className="absolute inset-0 rounded-full border-t-2 border-l-2 border-blue-500 animate-[spin_2s_linear_infinite]"></div>
                     <div className="absolute inset-2 rounded-full border-b-2 border-r-2 border-purple-500 animate-[spin_1.5s_linear_infinite_reverse]"></div>
                     <div className="absolute inset-4 rounded-full border-2 border-dashed border-white/20 animate-[spin_3s_linear_infinite]"></div>
                     <div className="absolute inset-0 flex items-center justify-center">
                       <Sparkles className="w-8 h-8 text-white animate-pulse" />
                     </div>
                  </div>
                  <h3 className="text-white font-bold text-lg mb-4 text-center tracking-wide">{loadingText}</h3>
                  <div className="w-full h-1 bg-neutral-900 rounded-full overflow-hidden border border-white/5">
                    <div className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-300 ease-out relative" style={{ width: `${progress}%` }}>
                       <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,0.3)_50%,transparent_75%,transparent_100%)] bg-[length:20px_20px] animate-[shimmer_1s_linear_infinite]"></div>
                    </div>
                  </div>
                  <div className="flex justify-between w-full mt-2">
                     <span className="text-[10px] text-neutral-500 font-mono">0xNANO_BANANA</span>
                     <span className="text-[10px] text-neutral-400 font-mono font-bold">{progress}%</span>
                  </div>
                </div>
              ) : imageUrls.length > 0 ? (
                <div className={`m-auto w-full grid gap-6 md:gap-8 max-w-6xl ${
                  imageUrls.length === 1 ? 'grid-cols-1 max-w-3xl' : 
                  imageUrls.length === 2 ? 'grid-cols-1 xl:grid-cols-2' : 
                  'grid-cols-1 md:grid-cols-2 xl:grid-cols-2'
                }`}>
                  {imageUrls.map((url, i) => (
                    <motion.div 
                      key={i} 
                      initial={{ opacity: 0, scale: 0.95, y: 10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      transition={{ duration: 0.4, delay: i * 0.1 }}
                      className="group relative bg-[#1a1a1a] border border-white/10 rounded-3xl overflow-hidden shadow-2xl hover:border-blue-500/50 transition-all flex items-center justify-center min-h-[200px]"
                    >
                       <img src={url} alt={`نتيجة ${i+1}`} className="w-full h-auto max-h-[60vh] object-contain group-hover:scale-[1.02] transition-transform duration-700" referrerPolicy="no-referrer" />
                       
                       <div className="absolute inset-0 flex flex-col justify-between opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-t from-black/90 via-black/20 to-black/40">
                         {/* Top Actions */}
                         <div className="flex justify-between items-start p-4">
                            <span className="bg-black/50 text-white/70 backdrop-blur-md px-3 py-1 rounded-full text-[10px] font-bold font-mono tracking-widest border border-white/10">RES {i+1}</span>
                            <div className="flex gap-2">
                               <button onClick={() => setSelectedImage(url)} className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white backdrop-blur-md transition-colors border border-white/10"><Maximize2 className="w-3.5 h-3.5" /></button>
                               <button onClick={() => openCropModal(url)} className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white backdrop-blur-md transition-colors border border-white/10"><Crop className="w-3.5 h-3.5" /></button>
                            </div>
                         </div>
                         
                         {/* Bottom Actions */}
                         <div className="p-4 sm:p-5 flex flex-wrap gap-2 justify-center pb-6 sm:pb-5">
                            <button onClick={() => handleUseAsInput(url)} className="flex items-center gap-2 bg-blue-600/90 hover:bg-blue-500 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition-transform active:scale-95 shadow-lg border border-blue-400/30 backdrop-blur-sm">
                              <ImagePlus className="w-3.5 h-3.5" /> مرجع
                            </button>
                            <button onClick={() => handleUpscale(url)} disabled={isUpscaling === url} className="flex items-center gap-2 bg-purple-600/90 hover:bg-purple-500 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition-transform active:scale-95 shadow-lg border border-purple-400/30 backdrop-blur-sm disabled:opacity-50">
                              {isUpscaling === url ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />} تكبير
                            </button>
                            <button onClick={() => openTemplateModal(url)} className="flex items-center justify-center w-10 h-10 bg-indigo-600/90 hover:bg-indigo-500 text-white rounded-xl transition-transform active:scale-95 shadow-lg border border-indigo-400/30 backdrop-blur-sm" title="وضع في قالب">
                              <LayoutTemplate className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => handleDownload(url)} className="flex items-center justify-center w-10 h-10 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-transform active:scale-95 shadow-lg border border-white/10 backdrop-blur-sm" title="تنزيل">
                              <Download className="w-3.5 h-3.5" />
                            </button>
                         </div>
                       </div>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="m-auto flex flex-col items-center justify-center text-center opacity-30 max-w-sm">
                   <div className="w-32 h-32 rounded-full border border-dashed border-white/20 flex items-center justify-center mb-6 bg-white/5">
                     <ImageIcon className="w-10 h-10 text-neutral-400" />
                   </div>
                   <p className="text-xl font-bold text-white mb-2 tracking-tight">لوحة الإبداع فارغة</p>
                   <p className="text-sm text-neutral-400 leading-relaxed">أدخل وصفك في القائمة الجانبية واضغط على "توليد إبداع جديد" لتطبع خيالك هنا.</p>
                </div>
              )}
           </div>

           {/* History Strip */}
           {history.length > 0 && (
             <div className="shrink-0 bg-[#0a0a0a] border-t border-white/5 z-20 flex flex-col">
                <div className="flex items-center justify-between px-6 py-2 border-b border-white/5 shrink-0">
                   <h3 className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest flex items-center gap-2">
                     <Clock className="w-3 h-3" /> سجل التوليد
                   </h3>
                   <button onClick={async () => {
                     if (user) {
                       try { for (const item of history) { await deleteDoc(doc(db, `users/${user.uid}/projects/${projectId}/history`, item.id)); } } 
                       catch (err) { handleFirestoreError(err, OperationType.DELETE, `users/${user.uid}/projects/${projectId}/history`); }
                     } else { setHistory([]); localStorage.removeItem(`xreef_history_${projectId}`); }
                   }} className="text-[10px] text-red-500 hover:text-red-400 font-medium px-2 py-1 bg-red-500/10 rounded-md transition-colors">
                     مسح السجل
                   </button>
                </div>
                <div className="flex-none px-6 py-3 overflow-x-auto overflow-y-hidden flex flex-nowrap gap-4 custom-scrollbar pb-4">
                   {history.map((item) => (
                     <div key={item.id} className="relative group shrink-0 w-[124px] h-[70px] sm:w-[160px] sm:h-[90px] rounded-xl overflow-hidden border border-white/10 hover:border-blue-500/50 transition-all cursor-pointer shadow-lg bg-[#141414] flex items-center justify-center" onClick={() => setSelectedImage(item.url)}>
                       <img src={item.url} alt="" className="max-w-full max-h-full object-contain group-hover:scale-110 transition-transform duration-500 opacity-80 group-hover:opacity-100" referrerPolicy="no-referrer" loading="lazy" />
                       <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent flex items-end p-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                         <p className="text-[8px] text-white/90 line-clamp-2 leading-tight" dir="rtl">{item.prompt}</p>
                       </div>
                     </div>
                   ))}
                </div>
             </div>
           )}
        </section>

      </main>
    </div>
  );
}
