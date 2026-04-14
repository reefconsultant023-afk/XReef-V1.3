import React, { useState, useRef, useEffect } from "react";
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2, Image as ImageIcon, Upload, X, Download, Sparkles, ChevronDown, ChevronUp, Maximize2, Clock, Trash2, Crop, Zap, ImagePlus, Library, Edit2, Plus, Save, LayoutTemplate, Settings2, LogIn, LogOut, Mail, Lock, UserPlus, ArrowLeft, LifeBuoy, Wand2, Folder } from "lucide-react";
import ReactCrop, { type Crop as CropType } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { auth, db, signInWithGoogle, signInWithEmail, signUpWithEmail, logOut, handleFirestoreError, OperationType } from '../firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { collection, doc, setDoc, onSnapshot, query, orderBy, deleteDoc } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';

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

  // Style Selection State
  const [selectedStyle, setSelectedStyle] = useState<string>("none");

  const IMAGE_STYLES = [
    { id: "none", name: "بدون ستايل", icon: "✨", prompt: "" },
    { id: "cinematic", name: "سينمائي", icon: "🎬", prompt: "cinematic lighting, highly detailed, 8k, masterpiece, dramatic atmosphere, professional photography" },
    { id: "anime", name: "أنمي", icon: "🌸", prompt: "anime style, vibrant colors, studio ghibli aesthetic, clean lines, high quality anime art" },
    { id: "3d", name: "ثلاثي الأبعاد", icon: "🧊", prompt: "3D render, Unreal Engine 5, octane render, ray tracing, volumetric lighting, hyper-realistic, detailed textures" },
    { id: "digital", name: "فن رقمي", icon: "🎨", prompt: "digital art, trending on artstation, sharp focus, intricate details, vibrant composition" },
    { id: "cyberpunk", name: "سايبربانك", icon: "🌃", prompt: "cyberpunk aesthetic, neon lights, futuristic, rainy night, high tech, glowing elements" },
    { id: "pixel", name: "بكسل آرت", icon: "👾", prompt: "pixel art style, 8-bit, 16-bit, retro game aesthetic, blocky, detailed pixel work" },
    { id: "oil", name: "لوحة زيتية", icon: "🖼️", prompt: "oil painting style, heavy brushstrokes, canvas texture, artistic, masterpiece, rich colors" },
    { id: "watercolor", name: "ألوان مائية", icon: "💧", prompt: "watercolor painting, soft edges, fluid colors, artistic, paper texture, elegant" },
    { id: "disney", name: "ديزني / بيكسار", icon: "🐭", prompt: "disney pixar animation style, 3d character design, cute, vibrant, high quality 3d render" },
    { id: "vintage", name: "قديم / كلاسيك", icon: "🎞️", prompt: "vintage photography, film grain, faded colors, nostalgic, 70s aesthetic, retro feel" },
    { id: "sketch", name: "رسم يدوي", icon: "✏️", prompt: "pencil sketch, hand-drawn, charcoal art, artistic, rough strokes, detailed line art" },
    { id: "fantasy", name: "خيالي", icon: "🧙", prompt: "fantasy world, ethereal, magical atmosphere, intricate details, epic scale, mythical" },
  ];

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
      let finalPromptToSend = prompt.trim();
      const styleObj = IMAGE_STYLES.find(s => s.id === selectedStyle);
      if (styleObj && styleObj.prompt) {
        finalPromptToSend += `, ${styleObj.prompt}`;
      }

      const response = await fetch("/api/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ 
          prompt: finalPromptToSend, 
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
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div 
      className="min-h-screen bg-cover bg-center bg-fixed relative flex flex-col items-center py-12 px-4 sm:px-6 lg:px-8 font-sans" 
      dir="rtl"
      style={{ backgroundImage: "url('https://images.unsplash.com/photo-1774308667027-3ce5c579a518?q=80&w=2064&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D')" }}
    >
      <style>{`
        @keyframes scan {
          0% { top: 0%; opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { top: 100%; opacity: 0; }
        }
        .animate-scan {
          animation: scan 2.5s linear infinite;
        }
        @keyframes pulse-ring {
          0% { transform: scale(0.8); opacity: 0.5; }
          100% { transform: scale(1.3); opacity: 0; }
        }
        .animate-pulse-ring {
          animation: pulse-ring 2s cubic-bezier(0.215, 0.61, 0.355, 1) infinite;
        }
        @keyframes shimmer {
          0% { background-position: 20px 0; }
          100% { background-position: 0 0; }
        }
      `}</style>

      {/* Auth Modal */}
      {isAuthModalOpen && !user && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={() => setIsAuthModalOpen(false)}>
          <div 
            className="bg-gray-900/90 backdrop-blur-xl border border-blue-500/30 p-8 rounded-3xl shadow-2xl max-w-md w-full relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button 
              onClick={() => setIsAuthModalOpen(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 rounded-full p-2 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="flex justify-center mb-6 mt-2">
              <Sparkles className="w-12 h-12 text-blue-500" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2 text-center">
              تسجيل الدخول
            </h2>
            <p className="text-gray-400 text-center mb-8 text-sm">
              يرجى استخدام حساب Google للمتابعة
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
      )}

      {/* Fullscreen Image Modal */}
      {selectedImage && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-md p-4 sm:p-8"
          onClick={() => setSelectedImage(null)}
        >
          <button 
            className="absolute top-6 right-6 text-white/70 hover:text-white bg-white/10 hover:bg-white/20 rounded-full p-3 transition-all"
            onClick={() => setSelectedImage(null)}
          >
            <X className="w-6 h-6" />
          </button>
          
          <img 
            src={selectedImage} 
            alt="عرض النتيجة بحجم الشاشة" 
            className="max-w-full max-h-full object-contain rounded-xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
          
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-4 flex-wrap justify-center w-full px-4" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => handleUseAsInput(selectedImage)}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-4 rounded-full font-bold transition-all shadow-lg hover:scale-105 border border-emerald-500"
            >
              <ImagePlus className="w-5 h-5" />
              استخدام كمرجع
            </button>
            <button
              onClick={() => handleUpscale(selectedImage)}
              disabled={isUpscaling === selectedImage}
              className="flex items-center gap-2 bg-purple-600 hover:bg-purple-500 text-white px-6 py-4 rounded-full font-bold transition-all shadow-lg hover:scale-105 border border-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isUpscaling === selectedImage ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Zap className="w-5 h-5" />
              )}
              {isUpscaling === selectedImage ? "جاري التكبير..." : "تكبير الدقة"}
            </button>
            <button
              onClick={() => {
                setSelectedImage(null);
                openCropModal(selectedImage);
              }}
              className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-white px-6 py-4 rounded-full font-bold transition-all shadow-lg hover:scale-105 border border-gray-600"
            >
              <Crop className="w-5 h-5" />
              قص
            </button>
            <button
              onClick={() => handleDownload(selectedImage)}
              className="flex items-center gap-3 bg-blue-600 hover:bg-blue-500 text-white px-8 py-4 rounded-full font-bold transition-all shadow-[0_0_30px_rgba(37,99,235,0.5)] hover:scale-105"
            >
              <Download className="w-5 h-5" />
              تنزيل الصورة
            </button>
          </div>
        </div>
      )}

      {/* Cropping Modal */}
      {imageToCrop && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/95 backdrop-blur-md p-4 sm:p-8">
          <button 
            className="absolute top-6 right-6 text-white/70 hover:text-white bg-white/10 hover:bg-white/20 rounded-full p-3 transition-all z-10"
            onClick={closeCropModal}
          >
            <X className="w-6 h-6" />
          </button>
          
          <div className="flex flex-col items-center justify-center max-h-full max-w-full w-full">
            <h3 className="text-white text-xl font-bold mb-4 drop-shadow-md">قص الصورة</h3>
            <div className="overflow-auto max-h-[70vh] max-w-full bg-black/50 rounded-xl border border-blue-500/30 p-2 shadow-2xl">
              <ReactCrop 
                crop={crop} 
                onChange={(_, percentCrop) => setCrop(percentCrop)}
                onComplete={(c) => setCompletedCrop(c)}
                className="max-h-[65vh]"
              >
                <img 
                  ref={imgRef}
                  src={imageToCrop} 
                  alt="قص الصورة" 
                  className="max-h-[65vh] w-auto object-contain"
                />
              </ReactCrop>
            </div>
            
            <div className="mt-8 flex gap-4">
              <button
                onClick={closeCropModal}
                className="px-8 py-3 rounded-full font-bold text-white bg-gray-700 hover:bg-gray-600 transition-all border border-gray-500"
              >
                إلغاء
              </button>
              <button
                onClick={handleSaveCrop}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-8 py-3 rounded-full font-bold transition-all shadow-[0_0_30px_rgba(37,99,235,0.5)] hover:scale-105"
              >
                <Download className="w-5 h-5" />
                حفظ وتنزيل
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dark Overlay for better readability - Black theme */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm"></div>

      {/* Main Content */}
      <div className="relative z-10 max-w-6xl w-full space-y-10">
        
        {/* Header */}
        <div className="flex flex-col items-center space-y-4 relative">
          <div className="absolute left-0 top-0 flex gap-2">
            <button 
              onClick={() => navigate('/')}
              className="flex items-center gap-2 bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white px-4 py-2 rounded-xl transition-all border border-white/10 backdrop-blur-sm"
            >
              <ArrowLeft size={18} />
              <span className="hidden sm:inline">الرجوع للمشاريع</span>
            </button>
            <button 
              onClick={() => navigate('/support')}
              className="flex items-center gap-2 bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white px-4 py-2 rounded-xl transition-all border border-white/10 backdrop-blur-sm"
            >
              <LifeBuoy size={18} />
              <span className="hidden sm:inline">الدعم الفني</span>
            </button>
          </div>
          <div className="absolute right-0 top-0">
            {user ? (
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  {user.photoURL && <img src={user.photoURL} alt="المستخدم" className="w-8 h-8 rounded-full border border-blue-500/30" />}
                  <span className="text-sm text-gray-300 hidden sm:inline-block">{user.displayName}</span>
                </div>
                <button
                  onClick={logOut}
                  className="flex items-center gap-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 px-4 py-2 rounded-full text-sm font-medium transition-colors border border-red-500/20"
                >
                  <LogOut className="w-4 h-4" />
                  تسجيل الخروج
                </button>
              </div>
            ) : (
              <button
                onClick={() => {
                  setAuthError(null);
                  setIsAuthModalOpen(true);
                }}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-full text-sm font-bold transition-all shadow-lg hover:scale-105"
              >
                <LogIn className="w-4 h-4" />
                تسجيل الدخول لحفظ بياناتك
              </button>
            )}
          </div>

          {projectName && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center gap-2 mt-16 sm:mt-0"
            >
              <div className="bg-blue-500/10 border border-blue-500/30 px-6 py-2 rounded-full backdrop-blur-md flex items-center gap-3">
                <Folder className="w-4 h-4 text-blue-400" />
                <span className="text-blue-400 font-bold text-lg">مشروع: {projectName}</span>
              </div>
              <div className="flex items-center gap-2 text-gray-400 text-sm bg-black/40 px-4 py-1 rounded-full border border-white/5">
                <Zap size={14} className="text-yellow-500" />
                <span>تم استهلاك <span className="text-white font-bold">{history.length}</span> مرة توليد صورة</span>
              </div>
            </motion.div>
          )}

          <h1 className="text-5xl md:text-7xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-blue-600 tracking-tight flex items-center justify-center gap-4 drop-shadow-lg">
            <Sparkles className="w-12 h-12 text-blue-500" />
            Xreef 1.4
          </h1>
          
          <p className="text-lg md:text-xl text-gray-300 max-w-2xl mx-auto font-light text-center">
            أطلق العنان لخيالك. قم بتوليد وتعديل الصور باستخدام أحدث تقنيات الذكاء الاصطناعي.
          </p>
        </div>

        {/* Glassmorphism Card */}
        <div className="bg-black/40 backdrop-blur-xl border border-blue-500/20 p-6 md:p-10 rounded-[2.5rem] shadow-2xl grid grid-cols-1 lg:grid-cols-2 gap-10">
          
          {/* Left Column: Controls */}
          <div className="space-y-8 flex flex-col">
            <form onSubmit={handleGenerate} className="flex flex-col flex-grow space-y-6">
              
              {/* Prompt Input */}
              <div className="space-y-3">
                <div className="flex items-center justify-between ml-1">
                  <label htmlFor="prompt" className="block text-sm font-medium text-gray-200">
                    ماذا تريد أن ترسم اليوم؟
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsPromptBankOpen(true)}
                    className="flex items-center gap-1.5 text-xs font-medium text-blue-400 hover:text-blue-300 transition-colors bg-blue-500/10 hover:bg-blue-500/20 px-3 py-1.5 rounded-full border border-blue-500/20"
                  >
                    <Library className="w-3.5 h-3.5" />
                    بنك الأوصاف
                  </button>
                </div>
                <textarea
                  id="prompt"
                  name="prompt"
                  rows={8}
                  className="appearance-none rounded-3xl relative block w-full px-6 py-4 bg-black/60 border border-blue-500/20 placeholder-gray-500 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent sm:text-base resize-none transition-all shadow-inner min-h-[150px]"
                  placeholder="مثال: مدينة مستقبلية مضيئة بالنيون تحت المطر، ألوان سينمائية..."
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  disabled={isLoading || isEnhancingPrompt}
                />
                <div className="flex justify-end mt-2">
                  <button
                    type="button"
                    onClick={handleEnhancePrompt}
                    disabled={!prompt.trim() || isEnhancingPrompt || isLoading}
                    className="flex items-center gap-2 text-sm font-medium text-purple-400 hover:text-purple-300 transition-colors bg-purple-500/10 hover:bg-purple-500/20 px-4 py-2 rounded-full border border-purple-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isEnhancingPrompt ? (
                      <>
                        <div className="w-4 h-4 border-2 border-purple-400 border-t-transparent rounded-full animate-spin"></div>
                        جاري الترجمة...
                      </>
                    ) : (
                      <>
                        <Wand2 className="w-4 h-4" />
                        ترجمة الوصف (Gemini Pro 3.1)
                      </>
                    )}
                  </button>
                </div>
                
                {/* Enhanced Prompt Result Box */}
                {enhancedPromptResult && (
                  <div className="mt-4 p-5 bg-purple-900/20 border border-purple-500/30 rounded-2xl shadow-inner animate-in fade-in slide-in-from-top-4 duration-300">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-bold text-purple-300 flex items-center gap-2">
                        <Wand2 className="w-4 h-4" />
                        نتيجة الترجمة (Gemini Pro 3.1)
                      </h4>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setPrompt(enhancedPromptResult);
                            setEnhancedPromptResult(null);
                          }}
                          className="text-xs font-medium bg-purple-600 hover:bg-purple-500 text-white px-3 py-1.5 rounded-full transition-colors shadow-md"
                        >
                          استخدام هذا الوصف
                        </button>
                        <button
                          type="button"
                          onClick={() => setEnhancedPromptResult(null)}
                          className="text-gray-400 hover:text-white p-1 rounded-full hover:bg-gray-800 transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <p className="text-sm text-purple-100/90 leading-relaxed" dir="ltr">
                      {enhancedPromptResult}
                    </p>
                  </div>
                )}
              </div>

              {/* Advanced Settings (Always Visible) */}
              <div className="space-y-5 p-5 bg-black/40 border border-blue-500/20 rounded-3xl shadow-inner">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Aspect Ratio */}
                  <div className="space-y-2">
                    <label className="block text-xs font-medium text-gray-400">
                      أبعاد الصورة
                    </label>
                    <select
                      value={aspectRatio}
                      onChange={(e) => setAspectRatio(e.target.value)}
                      className="w-full px-4 py-2.5 bg-black/60 border border-blue-500/20 rounded-xl text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 appearance-none"
                    >
                      <option value="1:1">مربع (1:1)</option>
                      <option value="16:9">شاشة عريضة (16:9)</option>
                      <option value="9:16">طولي (9:16)</option>
                      <option value="4:3">أفقي (4:3)</option>
                      <option value="3:4">عمودي (3:4)</option>
                    </select>
                  </div>

                  {/* Resolution */}
                  <div className="space-y-2">
                    <label className="block text-xs font-medium text-gray-400">
                      الدقة (Resolution)
                    </label>
                    <select
                      value={resolution}
                      onChange={(e) => setResolution(e.target.value)}
                      className="w-full px-4 py-2.5 bg-black/60 border border-blue-500/20 rounded-xl text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 appearance-none"
                    >
                      <option value="1K">عادي (1K)</option>
                      <option value="2K">عالي (2K)</option>
                      <option value="4K">فائق (4K)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Image Upload */}
              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-gray-200 ml-1">
                    صورة مرجعية (اختياري)
                  </label>
                  {imageFiles.length > 0 ? (
                    <div className="relative inline-block group w-full">
                      <img src={imageFiles[0]} alt="معاينة" className="h-32 w-full object-cover rounded-2xl border border-blue-500/30 shadow-xl" />
                      <button
                        type="button"
                        onClick={() => removeImage(0)}
                        className="absolute top-2 right-2 bg-red-500/80 hover:bg-red-500 text-white p-2 rounded-full backdrop-blur-md transition-colors shadow-lg"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div 
                      onClick={() => fileInputRef.current?.click()}
                      className="flex flex-col items-center justify-center w-full h-32 border-2 border-blue-500/20 border-dashed rounded-2xl hover:border-blue-500 hover:bg-blue-900/10 cursor-pointer transition-all group bg-black/40"
                    >
                      <Upload className="h-8 w-8 text-blue-500/50 group-hover:text-blue-400 transition-colors mb-2" />
                      <span className="text-sm text-gray-400 group-hover:text-gray-300">اضغط لرفع صورة مرجعية</span>
                    </div>
                  )}
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleImageUpload}
                    accept="image/*"
                    className="hidden"
                  />
                </div>
              </div>

              {/* Style Selector */}
              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-200 ml-1">
                  اختر ستايل الصورة
                </label>
                <div className="flex overflow-x-auto pb-2 gap-3 scrollbar-hide -mx-1 px-1">
                  {IMAGE_STYLES.map((style) => (
                    <button
                      key={style.id}
                      type="button"
                      onClick={() => setSelectedStyle(style.id)}
                      className={`flex-shrink-0 flex flex-col items-center justify-center w-24 h-24 rounded-2xl border transition-all duration-300 ${
                        selectedStyle === style.id
                          ? 'bg-blue-600/30 border-blue-500 shadow-[0_0_15px_rgba(37,99,235,0.3)]'
                          : 'bg-black/40 border-white/10 hover:border-white/30'
                      }`}
                    >
                      <span className="text-2xl mb-1">{style.icon}</span>
                      <span className={`text-[10px] font-bold ${selectedStyle === style.id ? 'text-white' : 'text-gray-400'}`}>
                        {style.name}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Submit Button */}
              <div className="pt-2 mt-auto">
                <button
                  type="submit"
                  disabled={isLoading || !prompt.trim()}
                  className={`group relative w-full flex justify-center py-4 px-4 border border-transparent text-lg font-bold rounded-3xl text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 focus:ring-offset-black disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 ${
                    isLoading 
                      ? 'bg-blue-900/80 shadow-[0_0_30px_-5px_rgba(37,99,235,0.4)]' 
                      : 'bg-gradient-to-r from-blue-600 to-blue-800 hover:from-blue-500 hover:to-blue-700 shadow-[0_0_40px_-10px_rgba(37,99,235,0.5)] hover:shadow-[0_0_60px_-15px_rgba(37,99,235,0.7)]'
                  }`}
                >
                  {isLoading ? (
                    <span className="flex items-center gap-3">
                      <div className="relative flex items-center justify-center w-6 h-6">
                        <div className="absolute w-full h-full border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                      </div>
                      جاري الإبداع...
                    </span>
                  ) : (
                    <span className="flex items-center gap-3">
                      <Sparkles className="w-6 h-6" />
                      توليد الصورة
                    </span>
                  )}
                </button>
              </div>
            </form>

            {/* Error Message */}
            {error && (
              <div className="rounded-2xl bg-red-500/10 p-5 border border-red-500/20 backdrop-blur-md">
                <div className="flex items-start">
                  <div className="ml-3">
                    <h3 className="text-sm font-bold text-red-400">حدث خطأ</h3>
                    <div className="mt-2 text-sm text-red-300/90 leading-relaxed">
                      <p>{error}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Result Area */}
          <div className="flex flex-col h-full">
            <div className="flex-grow rounded-[2rem] border border-blue-500/20 bg-black/60 overflow-hidden min-h-[400px] lg:min-h-[600px] flex items-center justify-center relative shadow-inner group">
              
              {/* Loading Overlay */}
              {isLoading && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 backdrop-blur-xl z-30 overflow-hidden transition-all duration-500">
                  {/* Diffusion Noise Simulation */}
                  <div 
                    className="absolute inset-0 mix-blend-overlay transition-all duration-200"
                    style={{
                      backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
                      transform: `scale(${1 + (progress / 100) * 0.5})`,
                      opacity: Math.max(0, 0.4 - (progress / 100) * 0.4)
                    }}
                  ></div>

                  {/* Background Glow */}
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(37,99,235,0.15)_0%,transparent_60%)] animate-pulse"></div>
                  
                  {/* Scanning Laser */}
                  <div className="absolute left-0 right-0 h-[2px] bg-blue-400 shadow-[0_0_20px_5px_rgba(59,130,246,0.6)] animate-scan z-0"></div>

                  <div className="relative flex items-center justify-center mb-8 z-10">
                    <div className="absolute w-24 h-24 border-t-2 border-r-2 border-blue-500 rounded-full animate-spin"></div>
                    <div className="absolute w-16 h-16 border-b-2 border-l-2 border-blue-300 rounded-full animate-[spin_1.5s_linear_infinite_reverse]"></div>
                    <div className="absolute w-24 h-24 border-2 border-blue-500/20 rounded-full animate-pulse-ring"></div>
                    <Sparkles className="w-8 h-8 text-blue-400 animate-pulse" />
                  </div>

                  <div className="relative z-10 flex flex-col items-center gap-3 w-full max-w-xs sm:max-w-sm px-4">
                    <h3 className="text-lg md:text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-blue-200 animate-pulse tracking-wide text-center">
                      {loadingText}
                    </h3>
                    
                    {/* Progress Bar */}
                    <div className="w-full h-2.5 bg-gray-900/80 rounded-full mt-4 overflow-hidden border border-blue-500/30 shadow-inner">
                      <div 
                        className="h-full bg-gradient-to-r from-blue-600 to-blue-400 transition-all duration-300 ease-out relative"
                        style={{ width: `${progress}%` }}
                      >
                        <div className="absolute top-0 right-0 bottom-0 left-0 bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,0.2)_50%,transparent_75%,transparent_100%)] bg-[length:10px_10px] animate-[shimmer_1s_linear_infinite]"></div>
                      </div>
                    </div>
                    <div className="flex justify-between w-full text-xs text-blue-300/70 mt-1 font-mono">
                      <span>{progress}%</span>
                      <span className="flex items-center gap-1">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        جاري المعالجة
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Image Display */}
              {imageUrls.length > 0 ? (
                <div className={`w-full h-full p-4 ${imageUrls.length > 1 ? 'grid grid-cols-1 md:grid-cols-2 gap-4 overflow-y-auto' : 'flex items-center justify-center'}`}>
                  {imageUrls.map((url, index) => (
                    <div key={index} className="relative group w-full h-full flex items-center justify-center bg-black/40 rounded-2xl overflow-hidden border border-blue-500/10 min-h-[300px]">
                      <img
                        src={url}
                        alt={`النتيجة المولدة ${index + 1}`}
                        className={`object-contain ${imageUrls.length > 1 ? 'max-h-[400px]' : 'w-full h-full'}`}
                        referrerPolicy="no-referrer"
                      />
                      {/* Desktop Action Buttons (Hover Reveal) */}
                      <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-20 px-2 flex-wrap">
                        <button
                          onClick={() => handleUseAsInput(url)}
                          className="flex items-center gap-1.5 bg-emerald-600/80 hover:bg-emerald-500 backdrop-blur-xl border border-emerald-500/50 text-white px-3 py-2 rounded-full font-bold transition-all shadow-[0_8px_30px_rgb(0,0,0,0.5)] hover:scale-105 text-xs sm:text-sm"
                        >
                          <ImagePlus className="w-4 h-4" />
                          كمرجع
                        </button>
                        <button
                          onClick={() => handleUpscale(url)}
                          disabled={isUpscaling === url}
                          className="flex items-center gap-1.5 bg-purple-600/80 hover:bg-purple-500 backdrop-blur-xl border border-purple-500/50 text-white px-3 py-2 rounded-full font-bold transition-all shadow-[0_8px_30px_rgb(0,0,0,0.5)] hover:scale-105 text-xs sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isUpscaling === url ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                          تكبير
                        </button>
                        <button
                          onClick={() => setSelectedImage(url)}
                          className="flex items-center gap-1.5 bg-black/60 hover:bg-blue-600/80 backdrop-blur-xl border border-blue-500/50 text-white px-3 py-2 rounded-full font-bold transition-all shadow-[0_8px_30px_rgb(0,0,0,0.5)] hover:scale-105 text-xs sm:text-sm"
                        >
                          <Maximize2 className="w-4 h-4" />
                          عرض
                        </button>
                        <button
                          onClick={() => openCropModal(url)}
                          className="flex items-center gap-1.5 bg-black/60 hover:bg-blue-600/80 backdrop-blur-xl border border-blue-500/50 text-white px-3 py-2 rounded-full font-bold transition-all shadow-[0_8px_30px_rgb(0,0,0,0.5)] hover:scale-105 text-xs sm:text-sm"
                        >
                          <Crop className="w-4 h-4" />
                          قص
                        </button>
                        <button
                          onClick={() => handleDownload(url)}
                          className="flex items-center gap-1.5 bg-blue-600/80 hover:bg-blue-500 backdrop-blur-xl border border-blue-400/50 text-white px-3 py-2 rounded-full font-bold transition-all shadow-[0_8px_30px_rgb(0,0,0,0.5)] hover:scale-105 text-xs sm:text-sm"
                        >
                          <Download className="w-4 h-4" />
                          تنزيل
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                /* Empty State */
                <div className="text-center text-blue-500/40 flex flex-col items-center gap-5 p-8">
                  <div className="w-24 h-24 rounded-full bg-blue-500/5 flex items-center justify-center mb-2 shadow-inner border border-blue-500/10">
                    <ImageIcon className="w-12 h-12 opacity-50" />
                  </div>
                  <p className="text-xl font-medium text-blue-200/70">مساحة العرض</p>
                  <p className="text-sm opacity-60 max-w-xs leading-relaxed text-blue-200/50">
                    أدخل وصفاً واضغط على زر التوليد لترى السحر يتحقق هنا
                  </p>
                </div>
              )}
            </div>
            
            {/* Mobile Action Buttons (Always visible on small screens when image exists) */}
            {imageUrls.length === 1 && (
              <div className="mt-6 lg:hidden grid grid-cols-2 sm:grid-cols-5 gap-3">
                <button
                  onClick={() => handleUseAsInput(imageUrls[0])}
                  className="w-full flex items-center justify-center gap-2 bg-emerald-600/40 hover:bg-emerald-600/60 backdrop-blur-md border border-emerald-500/30 text-white px-3 py-3 rounded-2xl font-bold transition-all active:scale-95 text-sm"
                >
                  <ImagePlus className="w-4 h-4" />
                  كمرجع
                </button>
                <button
                  onClick={() => handleUpscale(imageUrls[0])}
                  disabled={isUpscaling === imageUrls[0]}
                  className="w-full flex items-center justify-center gap-2 bg-purple-600/40 hover:bg-purple-600/60 backdrop-blur-md border border-purple-500/30 text-white px-3 py-3 rounded-2xl font-bold transition-all active:scale-95 text-sm disabled:opacity-50"
                >
                  {isUpscaling === imageUrls[0] ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                  تكبير
                </button>
                <button
                  onClick={() => setSelectedImage(imageUrls[0])}
                  className="w-full flex items-center justify-center gap-2 bg-black/40 hover:bg-black/60 backdrop-blur-md border border-blue-500/30 text-white px-3 py-3 rounded-2xl font-bold transition-all active:scale-95 text-sm"
                >
                  <Maximize2 className="w-4 h-4" />
                  عرض
                </button>
                <button
                  onClick={() => openCropModal(imageUrls[0])}
                  className="w-full flex items-center justify-center gap-2 bg-black/40 hover:bg-black/60 backdrop-blur-md border border-blue-500/30 text-white px-3 py-3 rounded-2xl font-bold transition-all active:scale-95 text-sm"
                >
                  <Crop className="w-4 h-4" />
                  قص
                </button>
                <button
                  onClick={() => handleDownload(imageUrls[0])}
                  className="w-full flex items-center justify-center gap-2 bg-blue-600/20 hover:bg-blue-600/40 backdrop-blur-md border border-blue-500/30 text-white px-3 py-3 rounded-2xl font-bold transition-all active:scale-95 text-sm"
                >
                  <Download className="w-4 h-4" />
                  تنزيل
                </button>
                <button
                  onClick={() => openTemplateModal(imageUrls[0])}
                  className="w-full flex items-center justify-center gap-2 bg-indigo-600/20 hover:bg-indigo-600/40 backdrop-blur-md border border-indigo-500/30 text-white px-3 py-3 rounded-2xl font-bold transition-all active:scale-95 text-sm"
                >
                  <LayoutTemplate className="w-4 h-4" />
                  في قالب
                </button>
              </div>
            )}
          </div>

        </div>

        {/* History Section */}
        {history.length > 0 && (
          <div className="bg-black/40 backdrop-blur-xl border border-blue-500/20 p-6 md:p-10 rounded-[2.5rem] shadow-2xl mt-10">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
              <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                <Clock className="w-6 h-6 text-blue-400" />
                سجل الصور السابقة
              </h2>
              <button 
                onClick={async () => {
                  if (user) {
                    try {
                      for (const item of history) {
                        await deleteDoc(doc(db, `users/${user.uid}/projects/${projectId}/history`, item.id));
                      }
                    } catch (err) {
                      handleFirestoreError(err, OperationType.DELETE, `users/${user.uid}/projects/${projectId}/history`);
                    }
                  } else {
                    setHistory([]);
                    localStorage.removeItem(`xreef_history_${projectId}`);
                  }
                }} 
                className="text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 px-4 py-2 rounded-xl flex items-center gap-2 text-sm transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                مسح السجل
              </button>
            </div>
            
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {history.map((item) => (
                <div key={item.id} className="relative group rounded-2xl overflow-hidden border border-blue-500/20 aspect-square bg-black/60 shadow-lg">
                  <img 
                    src={item.url} 
                    alt={item.prompt} 
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" 
                    referrerPolicy="no-referrer"
                    loading="lazy"
                    decoding="async"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4">
                    <p className="text-xs text-blue-100 line-clamp-3 mb-3 leading-relaxed" dir="rtl">{item.prompt}</p>
                    <div className="flex justify-center gap-2 flex-wrap">
                      <button 
                        onClick={() => handleUseAsInput(item.url)} 
                        className="bg-emerald-600/80 hover:bg-emerald-500 text-white p-2.5 rounded-full backdrop-blur-md transition-colors"
                        title="استخدام كمرجع"
                      >
                        <ImagePlus className="w-4 h-4"/>
                      </button>
                      <button 
                        onClick={() => handleUpscale(item.url)} 
                        disabled={isUpscaling === item.url}
                        className="bg-purple-600/80 hover:bg-purple-500 text-white p-2.5 rounded-full backdrop-blur-md transition-colors disabled:opacity-50"
                        title="تكبير الدقة"
                      >
                        {isUpscaling === item.url ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4"/>}
                      </button>
                      <button 
                        onClick={() => setSelectedImage(item.url)} 
                        className="bg-blue-600/80 hover:bg-blue-500 text-white p-2.5 rounded-full backdrop-blur-md transition-colors"
                        title="عرض"
                      >
                        <Maximize2 className="w-4 h-4"/>
                      </button>
                      <button 
                        onClick={() => openCropModal(item.url)} 
                        className="bg-gray-700/80 hover:bg-gray-600 text-white p-2.5 rounded-full backdrop-blur-md transition-colors"
                        title="قص"
                      >
                        <Crop className="w-4 h-4"/>
                      </button>
                      <button 
                        onClick={() => handleDownload(item.url)} 
                        className="bg-blue-600/80 hover:bg-blue-500 text-white p-2.5 rounded-full backdrop-blur-md transition-colors"
                        title="تنزيل"
                      >
                        <Download className="w-4 h-4"/>
                      </button>
                      <button 
                        onClick={() => openTemplateModal(item.url)} 
                        className="bg-indigo-600/80 hover:bg-indigo-500 text-white p-2.5 rounded-full backdrop-blur-md transition-colors"
                        title="تنزيل في قالب"
                      >
                        <LayoutTemplate className="w-4 h-4"/>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Prompt Bank Modal */}
      {isPromptBankOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 sm:p-8" onClick={() => setIsPromptBankOpen(false)}>
          <div 
            className="bg-gray-900 border border-blue-500/30 rounded-3xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-800 bg-black/20">
              <div className="flex items-center gap-4">
                <h3 className="text-2xl font-bold text-white flex items-center gap-3">
                  <Library className="w-6 h-6 text-blue-400" />
                  بنك الأوصاف (Prompt Bank)
                </h3>
                <button
                  onClick={() => setIsPromptBankEditMode(!isPromptBankEditMode)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    isPromptBankEditMode 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700'
                  }`}
                >
                  <Edit2 className="w-4 h-4" />
                  {isPromptBankEditMode ? 'إنهاء التعديل' : 'تعديل'}
                </button>
              </div>
              <button 
                onClick={() => setIsPromptBankOpen(false)}
                className="text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 rounded-full p-2 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {/* Content */}
            <div className="overflow-y-auto p-6 space-y-8 custom-scrollbar">
              {promptBank.map((category, idx) => (
                <div key={idx} className="space-y-4">
                  <div className="flex items-center justify-between border-b border-gray-800 pb-2">
                    <h4 className="text-lg font-semibold text-blue-300 flex items-center gap-2">
                      {category.category}
                    </h4>
                    {isPromptBankEditMode && (
                      <button
                        onClick={() => handleDeleteCategory(idx)}
                        className="text-red-400 hover:text-red-300 p-1.5 rounded-lg hover:bg-red-500/10 transition-colors"
                        title="حذف التصنيف"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {category.prompts.map((p, pIdx) => (
                      <div key={pIdx} className="relative group flex flex-col">
                        <button
                          onClick={() => {
                            if (isPromptBankEditMode) return;
                            setPrompt(p.prompt);
                            setIsPromptBankOpen(false);
                          }}
                          className={`flex flex-col items-start text-right p-4 rounded-2xl bg-gray-800/50 border transition-all h-full ${
                            isPromptBankEditMode 
                              ? 'border-gray-700 cursor-default' 
                              : 'hover:bg-blue-900/30 border-gray-700 hover:border-blue-500/50 cursor-pointer'
                          }`}
                        >
                          <span className="font-bold text-gray-200 group-hover:text-blue-300 mb-2 pr-8">{p.title}</span>
                          <span className="text-xs text-gray-400 line-clamp-3 leading-relaxed" dir="ltr">{p.prompt}</span>
                        </button>
                        
                        {isPromptBankEditMode && (
                          <div className="absolute top-3 right-3 flex items-center gap-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingPrompt({ catIdx: idx, promptIdx: pIdx, title: p.title, prompt: p.prompt });
                              }}
                              className="p-1.5 text-gray-400 hover:text-blue-400 bg-gray-900 rounded-lg border border-gray-700 hover:border-blue-500/50 transition-colors"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeletePrompt(idx, pIdx);
                              }}
                              className="p-1.5 text-gray-400 hover:text-red-400 bg-gray-900 rounded-lg border border-gray-700 hover:border-red-500/50 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                    
                    {/* Add Prompt Button */}
                    {isPromptBankEditMode && (
                      <button
                        onClick={() => setEditingPrompt({ catIdx: idx, promptIdx: -1, title: "", prompt: "" })}
                        className="flex flex-col items-center justify-center text-center p-4 rounded-2xl bg-gray-800/20 hover:bg-gray-800/50 border border-dashed border-gray-700 hover:border-blue-500/50 transition-all text-gray-400 hover:text-blue-400 min-h-[120px]"
                      >
                        <Plus className="w-6 h-6 mb-2" />
                        <span className="text-sm font-medium">إضافة وصف جديد</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}

              {/* Add Category Section */}
              {isPromptBankEditMode && (
                <div className="pt-6 border-t border-gray-800">
                  {isAddingCategory ? (
                    <div className="flex items-center gap-3 bg-gray-800/50 p-4 rounded-2xl border border-gray-700">
                      <input
                        type="text"
                        value={newCategoryName}
                        onChange={(e) => setNewCategoryName(e.target.value)}
                        placeholder="اسم التصنيف الجديد..."
                        className="flex-1 bg-black/50 border border-gray-600 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-blue-500"
                        autoFocus
                      />
                      <button
                        onClick={handleAddCategory}
                        className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl font-medium transition-colors"
                      >
                        إضافة
                      </button>
                      <button
                        onClick={() => {
                          setIsAddingCategory(false);
                          setNewCategoryName("");
                        }}
                        className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-xl font-medium transition-colors"
                      >
                        إلغاء
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setIsAddingCategory(true)}
                      className="flex items-center justify-center gap-2 w-full p-4 rounded-2xl bg-gray-800/20 hover:bg-gray-800/50 border border-dashed border-gray-700 hover:border-blue-500/50 transition-all text-gray-400 hover:text-blue-400"
                    >
                      <Plus className="w-5 h-5" />
                      <span className="font-medium">إضافة تصنيف جديد</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Edit/Add Prompt Modal */}
      {editingPrompt && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={() => setEditingPrompt(null)}>
          <div 
            className="bg-gray-900 border border-blue-500/30 rounded-3xl shadow-2xl w-full max-w-lg p-6 space-y-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-xl font-bold text-white flex items-center gap-2 border-b border-gray-800 pb-4">
              <Edit2 className="w-5 h-5 text-blue-400" />
              {editingPrompt.promptIdx === -1 ? 'إضافة وصف جديد' : 'تعديل الوصف'}
            </h3>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-300">عنوان الوصف</label>
                <input
                  type="text"
                  value={editingPrompt.title}
                  onChange={(e) => setEditingPrompt({...editingPrompt, title: e.target.value})}
                  placeholder="مثال: مدينة مستقبلية"
                  className="w-full bg-black/50 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500"
                />
              </div>
              
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-300">النص (Prompt)</label>
                <textarea
                  value={editingPrompt.prompt}
                  onChange={(e) => setEditingPrompt({...editingPrompt, prompt: e.target.value})}
                  placeholder="أدخل الوصف باللغة الإنجليزية..."
                  rows={5}
                  className="w-full bg-black/50 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 resize-none"
                  dir="ltr"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-800">
              <button
                onClick={() => setEditingPrompt(null)}
                className="px-5 py-2.5 rounded-xl text-gray-300 hover:text-white hover:bg-gray-800 font-medium transition-colors"
              >
                إلغاء
              </button>
              <button
                onClick={handleSavePrompt}
                disabled={!editingPrompt.title.trim() || !editingPrompt.prompt.trim()}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-400 text-white px-6 py-2.5 rounded-xl font-bold transition-colors"
              >
                <Save className="w-4 h-4" />
                حفظ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Template Modal */}
      {isTemplateModalOpen && imageToTemplate && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4" onClick={() => setIsTemplateModalOpen(false)}>
          <div 
            className="bg-gray-900 border border-indigo-500/30 rounded-3xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-800 bg-black/20">
              <h3 className="text-2xl font-bold text-white flex items-center gap-3">
                <LayoutTemplate className="w-6 h-6 text-indigo-400" />
                تنزيل بداخل القالب
              </h3>
              <button 
                onClick={() => setIsTemplateModalOpen(false)}
                className="text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 rounded-full p-2 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {/* Content */}
            <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
              {/* Left/Top: Preview */}
              <div className="flex-1 p-6 bg-black/50 overflow-auto flex items-center justify-center relative">
                {!templateImage ? (
                  <div className="text-center space-y-4">
                    <div className="w-24 h-24 bg-gray-800 rounded-full flex items-center justify-center mx-auto border border-dashed border-gray-600">
                      <Upload className="w-10 h-10 text-gray-400" />
                    </div>
                    <p className="text-gray-400">الرجاء رفع صورة القالب أولاً</p>
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={handleTemplateUpload} 
                      className="hidden" 
                      id="template-upload" 
                    />
                    <label 
                      htmlFor="template-upload" 
                      className="inline-block bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2.5 rounded-xl font-medium cursor-pointer transition-colors"
                    >
                      اختيار صورة القالب
                    </label>
                  </div>
                ) : (
                  <div className="relative shadow-2xl" style={{ maxWidth: '100%', maxHeight: '100%' }}>
                    <canvas ref={templateCanvasRef} className="max-w-full max-h-[60vh] md:max-h-[70vh] object-contain" />
                  </div>
                )}
              </div>

              {/* Right/Bottom: Controls */}
              {templateImage && (
                <div className="w-full md:w-80 p-6 border-t md:border-t-0 md:border-r border-gray-800 bg-gray-900/50 overflow-y-auto space-y-6">
                  <div className="space-y-4">
                    <h4 className="text-lg font-semibold text-white flex items-center gap-2">
                      <Settings2 className="w-5 h-5 text-indigo-400" />
                      إعدادات الموضع
                    </h4>
                    
                    <div className="space-y-2">
                      <label className="flex justify-between text-sm text-gray-300">
                        <span>الحجم (Scale)</span>
                        <span>{templateSettings.scale}%</span>
                      </label>
                      <input 
                        type="range" 
                        min="10" max="200" 
                        value={templateSettings.scale} 
                        onChange={(e) => setTemplateSettings({...templateSettings, scale: parseInt(e.target.value)})}
                        className="w-full accent-indigo-500"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="flex justify-between text-sm text-gray-300">
                        <span>الموضع الأفقي (X)</span>
                        <span>{templateSettings.offsetX}%</span>
                      </label>
                      <input 
                        type="range" 
                        min="0" max="100" 
                        value={templateSettings.offsetX} 
                        onChange={(e) => setTemplateSettings({...templateSettings, offsetX: parseInt(e.target.value)})}
                        className="w-full accent-indigo-500"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="flex justify-between text-sm text-gray-300">
                        <span>الموضع الرأسي (Y)</span>
                        <span>{templateSettings.offsetY}%</span>
                      </label>
                      <input 
                        type="range" 
                        min="0" max="100" 
                        value={templateSettings.offsetY} 
                        onChange={(e) => setTemplateSettings({...templateSettings, offsetY: parseInt(e.target.value)})}
                        className="w-full accent-indigo-500"
                      />
                    </div>
                  </div>

                  <div className="pt-4 border-t border-gray-800 space-y-3">
                    <button 
                      onClick={handleDownloadTemplate}
                      className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-3 rounded-xl font-bold transition-colors"
                    >
                      <Download className="w-5 h-5" />
                      تنزيل الصورة النهائية
                    </button>
                    
                    <div className="text-center">
                      <input 
                        type="file" 
                        accept="image/*" 
                        onChange={handleTemplateUpload} 
                        className="hidden" 
                        id="template-change" 
                      />
                      <label 
                        htmlFor="template-change" 
                        className="text-sm text-gray-400 hover:text-white cursor-pointer transition-colors"
                      >
                        تغيير القالب
                      </label>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
