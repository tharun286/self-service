import { useState, useEffect, useRef } from 'react';
import { User } from '../hls_main_page';
import { Header } from './Header';
import {
  Tag, Upload, FileText, Plus, Pencil, X,
  Paperclip, Loader2, Search, ChevronLeft, ChevronRight,
  ArrowUp, ArrowDown, Layers, Globe, CheckCircle2, AlertCircle,
  RefreshCw, CloudUpload, FolderOpen, LayoutTemplate
} from 'lucide-react';
import { Brand, getAllBrands, addBrand, editBrand, syncFromConnector } from '../services/brandsApi';
import { uploadToVeeva, VeevaUploadResult } from '../services/veevaUploadApi';
import { VeevaDocument, fetchVeevaDocsFromVeeva, getVeevaDocs, updateVeevaDoc, createBrandingDoc } from '../services/brandingDocsApi';
import { DocumentType, getAllDocumentTypes, addDocumentType, editDocumentType } from '../services/documentTypesApi';
import { Market, getAllMarkets, addMarket, editMarket } from '../services/marketsApi';
import { getHLSChatHistory } from '../services/chatHistoryApi';
import { DomainType, getDomain, useDomain } from '../context/DomainContext';
import { uploadLocalDocument } from '../services/localDocumentsApi';
import { getTemplates, saveTemplate, deleteTemplate, StyleTemplate } from '../services/templatesApi';

type ConfigurationPageProps = {
  user: User | null;
  onLogout: () => void;
  onBack: () => void;
  onAdminClick: () => void;
  onPersonalizationClick: () => void;
  onPersonalizeContentClick: () => void;
  onConfigurationClick?: () => void;
  onWorkflowClick?: () => void;
};

type SidebarOption = 'brands' | 'upload-to-veeva' | 'branding-documents' | 'document-types' | 'markets' | 'local-documents' | 'templates' | 'chat-history';

const VEEVA_SIDEBAR_ITEMS: { id: SidebarOption; label: string; icon: React.ElementType }[] = [
  { id: 'brands', label: 'Brands', icon: Tag },
  { id: 'document-types', label: 'Asset Types', icon: Layers },
  { id: 'markets', label: 'Markets', icon: Globe },
  { id: 'upload-to-veeva', label: 'Upload to Veeva', icon: CloudUpload },
  { id: 'branding-documents', label: 'Branding Documents', icon: FileText },
  { id: 'chat-history', label: 'Chat History', icon: FileText },
];

const LOCAL_SIDEBAR_ITEMS: { id: SidebarOption; label: string; icon: React.ElementType }[] = [
  { id: 'brands', label: 'Brands', icon: Tag },
  { id: 'document-types', label: 'Asset Types', icon: Layers },
  { id: 'markets', label: 'Markets', icon: Globe },
  { id: 'templates', label: 'Templates', icon: LayoutTemplate },
  { id: 'local-documents', label: 'Local Documents', icon: FolderOpen },
  { id: 'chat-history', label: 'Chat History', icon: FileText },
];

const emptyBrandForm = {
  brand_name: '',
  primary_brand_color: '',
  secondary_brand_color: '',
  color_palette: '',
  podcast_guidelines: '',
};

type SortKey = 'brand_name' | 'primary_brand_color' | 'secondary_brand_color';
const PAGE_SIZE = 8;

const inputCls =
  'w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-[#53A2FF]/30 focus:border-[#53A2FF] transition-colors placeholder:text-slate-400';

const inputErrCls =
  'w-full border border-red-300 rounded-lg px-3 py-2 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-red-200 focus:border-red-400 transition-colors placeholder:text-slate-400';

// ── Shared alert banner ──
function AlertBanner({
  type, message, onDismiss,
}: { type: 'success' | 'error'; message: string; onDismiss?: () => void }) {
  return (
    <div className={`flex items-start gap-2.5 rounded-lg px-4 py-3 text-sm mb-4 ${type === 'success'
      ? 'bg-green-50 border border-green-200 text-green-700'
      : 'bg-red-50 border border-red-200 text-red-700'
      }`}>
      {type === 'success'
        ? <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
        : <AlertCircle size={16} className="shrink-0 mt-0.5" />}
      <p className="flex-1">{message}</p>
      {onDismiss && (
        <div onClick={onDismiss} className="shrink-0 opacity-60 hover:opacity-100 transition-opacity cursor-pointer">
          <X size={14} />
        </div>
      )}
    </div>
  );
}

// ── Shared panel wrapper ──
const PanelWrapper = ({ children }: { children: React.ReactNode }) => (
  <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
    {children}
  </div>
);

// ── Shared panel header bar ──
const PanelBar = ({ title, children }: { title: string; children?: React.ReactNode }) => (
  <div className="flex items-center gap-4 px-5 py-3.5" style={{ backgroundColor: '#53A2FF' }}>
    <div className="text-white font-semibold text-3xl whitespace-nowrap tracking-wide">{title}</div>
    {children}
  </div>
);

const HlsPanelBar = ({ title, children }: { title: string; children?: React.ReactNode }) => (
  <div className="flex items-center gap-4 px-5 py-3.5" style={{ backgroundColor: 'var(--hls-primary)' }}>
    <div className="text-white font-semibold text-3xl whitespace-nowrap tracking-wide">{title}</div>
    {children}
  </div>
);

// ── Loading skeleton row ──
const LoadingState = ({ message = 'Loading…' }: { message?: string }) => (
  <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-400">
    <Loader2 size={24} className="animate-spin" style={{ color: '#53A2FF' }} />
    <div className="text-sm">{message}</div>
  </div>
);

// ── Empty state ──
const EmptyState = ({ icon: Icon, title, subtitle }: { icon: React.ElementType; title: string; subtitle?: string }) => (
  <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-400">
    <div className="size-12 rounded-full bg-slate-50 flex items-center justify-center">
      <Icon size={22} className="text-slate-300" />
    </div>
    <div className="text-center">
      <div className="text-sm font-medium text-slate-500">{title}</div>
      {subtitle && <div className="text-xs text-slate-400 mt-1">{subtitle}</div>}
    </div>
  </div>
);

export function ConfigurationPage({
  user,
  onLogout,
  onBack,
  onAdminClick,
  onPersonalizationClick,
  onPersonalizeContentClick,
  onConfigurationClick,
  onWorkflowClick

}: ConfigurationPageProps) {
  const [activeOption, setActiveOption] = useState<SidebarOption>('brands');
  const domain: DomainType = getDomain();
  const { features } = useDomain();
  const sidebarItems = features.showVeevaIntegration ? VEEVA_SIDEBAR_ITEMS : LOCAL_SIDEBAR_ITEMS;

  // ── Local Documents (non-Veeva domains) ──
  const [localFile, setLocalFile] = useState<File | null>(null);
  const [localDocName, setLocalDocName] = useState('');
  const [localBrandId, setLocalBrandId] = useState('');
  const [localDocTypeId, setLocalDocTypeId] = useState('');
  const [localMarketId, setLocalMarketId] = useState('');
  const [localUploading, setLocalUploading] = useState(false);
  const [localResult, setLocalResult] = useState<{ success: boolean; error?: string; message?: string } | null>(null);
  const [localFileTouched, setLocalFileTouched] = useState(false);
  const localFileRef = useRef<HTMLInputElement>(null);
  const [localDocs, setLocalDocs] = useState<VeevaDocument[]>([]);
  const [localDocsLoading, setLocalDocsLoading] = useState(false);

  // ── Brands ──
  const [brands, setBrands] = useState<Brand[]>([]);
  const [brandsLoading, setBrandsLoading] = useState(false);
  const [brandsError, setBrandsError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('brand_name');
  const [sortAsc, setSortAsc] = useState(true);
  const [page, setPage] = useState(1);
  const [showBrandModal, setShowBrandModal] = useState(false);
  const [editingBrand, setEditingBrand] = useState<Brand | null>(null);
  const [brandForm, setBrandForm] = useState(emptyBrandForm);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [brandSaving, setBrandSaving] = useState(false);
  const [brandSaveError, setBrandSaveError] = useState<string | null>(null);
  const [brandNameTouched, setBrandNameTouched] = useState(false);
  const [brandDataFetching, setBrandDataFetching] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Upload to Veeva ──
  const [veevaFile, setVeevaFile] = useState<File | null>(null);
  const [veevaDocName, setVeevaDocName] = useState('');
  const [veevaBrandId, setVeevaBrandId] = useState('');
  const [veevaDocTypeId, setVeevaDocTypeId] = useState('');
  const [veevaMarketId, setVeevaMarketId] = useState('');
  const [veevaUploading, setVeevaUploading] = useState(false);
  const [veevaResult, setVeevaResult] = useState<VeevaUploadResult | null>(null);
  const [veevaFileTouched, setVeevaFileTouched] = useState(false);
  const veevaFileRef = useRef<HTMLInputElement>(null);

  // ── Branding Documents ──
  const [brandingDocs, setBrandingDocs] = useState<VeevaDocument[]>([]);
  const [brandingDocsLoading, setBrandingDocsLoading] = useState(false);
  const [brandingDocsFetching, setBrandingDocsFetching] = useState(false);
  const [brandingDocsError, setBrandingDocsError] = useState<string | null>(null);
  const [brandingFetchMsg, setBrandingFetchMsg] = useState<string | null>(null);
  const [editingDoc, setEditingDoc] = useState<VeevaDocument | null>(null);
  const [docEditForm, setDocEditForm] = useState({ brand_id: '', document_type_id: '', market_id: '' });
  const [docEditSaving, setDocEditSaving] = useState(false);
  const [docEditError, setDocEditError] = useState<string | null>(null);
  const [brandingDocsSearch, setBrandingDocsSearch] = useState('');
  const [brandingDocsPage, setBrandingDocsPage] = useState(1);

  // ── Asset Types ──
  const [docTypes, setDocTypes] = useState<DocumentType[]>([]);
  const [docTypesLoading, setDocTypesLoading] = useState(false);
  const [docTypesError, setDocTypesError] = useState<string | null>(null);
  const [showDocTypeModal, setShowDocTypeModal] = useState(false);
  const [editingDocType, setEditingDocType] = useState<DocumentType | null>(null);
  const [docTypeForm, setDocTypeForm] = useState('');
  const [docTypeSaving, setDocTypeSaving] = useState(false);
  const [docTypeModalError, setDocTypeModalError] = useState<string | null>(null);
  const [docTypeFormTouched, setDocTypeFormTouched] = useState(false);
  const [docTypeSearch, setDocTypeSearch] = useState('');
  const [docTypePage, setDocTypePage] = useState(1);

  // ── Markets ──
  const [markets, setMarkets] = useState<Market[]>([]);
  const [marketsLoading, setMarketsLoading] = useState(false);
  const [marketsError, setMarketsError] = useState<string | null>(null);
  const [showMarketModal, setShowMarketModal] = useState(false);
  const [editingMarket, setEditingMarket] = useState<Market | null>(null);
  const [marketForm, setMarketForm] = useState('');
  const [marketSaving, setMarketSaving] = useState(false);
  const [marketModalError, setMarketModalError] = useState<string | null>(null);
  const [marketFormTouched, setMarketFormTouched] = useState(false);
  const [marketSearch, setMarketSearch] = useState('');
  const [marketPage, setMarketPage] = useState(1);

  // ── Chat History ──
  const [chatHistory, setChatHistory] = useState<any[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [chatPage, setChatPage] = useState(1);
  const [chatTotalPages, setChatTotalPages] = useState(1);
  const [expandedChatRow, setExpandedChatRow] = useState<number | null>(null);
  const [chatTotal, setChatTotal] = useState(0);

  // ── Templates ──
  const [templates, setTemplates] = useState<StyleTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [templatesError, setTemplatesError] = useState<string | null>(null);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [templateForm, setTemplateForm] = useState({ name: '', brand_id: '' });
  const [templateReferences, setTemplateReferences] = useState<{ layoutType: string, file: File, preview: string }[]>([]);
  const [templateSaving, setTemplateSaving] = useState(false);
  const [templateModalError, setTemplateModalError] = useState<string | null>(null);
  const [templateFormTouched, setTemplateFormTouched] = useState(false);
  const [templateSearch, setTemplateSearch] = useState('');
  const [templatePage, setTemplatePage] = useState(1);
  const templateFileInputRef = useRef<HTMLInputElement>(null);

  // __ Load on component mount __
  useEffect(() => {
    if (features.showVeevaIntegration) {
      handleFetchFromVeeva();
      handleBrandSync();
    } else {
      fetchBrands();
    }
  }, []);

  // ── Load on tab switch ──
  useEffect(() => {
    if (activeOption === 'brands') fetchBrands();
    if (activeOption === 'branding-documents') loadBrandingDocs();
    if (activeOption === 'document-types') loadDocTypes();
    if (activeOption === 'markets') loadMarkets();
    if (activeOption === 'upload-to-veeva') { fetchBrands(); loadDocTypes(); loadMarkets(); }
    if (activeOption === 'templates') { fetchBrands(); loadTemplates(); }
    if (activeOption === 'local-documents') {
      fetchBrands(); loadDocTypes(); loadMarkets();
      loadLocalDocs();
    }
    if (activeOption === 'chat-history') fetchChatHistory(chatPage);
  }, [activeOption]);

  useEffect(() => {
    if (activeOption === 'chat-history') fetchChatHistory(chatPage);
  }, [chatPage]);

  const fetchChatHistory = async (page = 1) => {
    setChatLoading(true); setChatError(null);
    try {
      const data = await getHLSChatHistory(page, PAGE_SIZE, domain);
      setChatHistory(data.items || []);
      const total = data.total || 0;
      setChatTotal(total);
      setChatTotalPages(Math.max(1, Math.ceil(total / PAGE_SIZE)));
    } catch (e: any) {
      setChatError(e.message || 'Failed to load chat history');
    } finally {
      setChatLoading(false);
    }
  };

  const loadLocalDocs = async () => {
    setLocalDocsLoading(true);
    try { setLocalDocs(await getVeevaDocs(domain)); }
    catch (_) { /* surfaced via list empty state */ }
    finally { setLocalDocsLoading(false); }
  };

  const handleLocalUpload = async () => {
    setLocalFileTouched(true);
    if (!localFile || localUploading) return;
    setLocalUploading(true); setLocalResult(null);
    try {
      const result = await uploadLocalDocument(localFile, domain, {
        docName: localDocName || undefined,
        brandId: localBrandId || undefined,
        documentTypeId: localDocTypeId || undefined,
        marketId: localMarketId || undefined,
      });
      setLocalResult({
        success: result.success,
        message: result.success ? 'Document uploaded successfully' : undefined,
        error: result.error,
      });
      if (result.success) {
        setLocalFile(null); setLocalDocName(''); setLocalFileTouched(false);
        setLocalBrandId(''); setLocalDocTypeId(''); setLocalMarketId('');
        if (localFileRef.current) localFileRef.current.value = '';
        loadLocalDocs();
      }
    } catch (err: unknown) {
      setLocalResult({ success: false, error: err instanceof Error ? err.message : 'Upload failed' });
    } finally {
      setLocalUploading(false);
    }
  };

  const handleBrandSync = async () => {
    setBrandDataFetching(true);
    try {
      await syncFromConnector(domain);
    } catch (e: any) {
      setBrandsError(e.message || `Failed to fetch from ${domain}`);
    } finally {
      setBrandDataFetching(false);
      fetchBrands();
    }
  };

  const fetchBrands = async () => {
    setBrandsLoading(true); setBrandsError(null);
    try { setBrands(await getAllBrands(domain)); }
    catch (e: any) { setBrandsError(e.message || 'Failed to load brands'); }
    finally { setBrandsLoading(false); }
  };

  const loadBrandingDocs = async () => {
    setBrandingDocs([]);
    setBrandingDocsLoading(true); setBrandingDocsError(null);
    try { setBrandingDocs(await getVeevaDocs(domain)); }
    catch (e: any) { setBrandingDocsError(e.message || 'Failed to load documents'); }
    finally { setBrandingDocsLoading(false); }
  };

  const loadDocTypes = async () => {
    setDocTypesLoading(true); setDocTypesError(null);
    try { setDocTypes(await getAllDocumentTypes(domain)); }
    catch (e: any) { setDocTypesError(e.message || 'Failed to load document types'); }
    finally { setDocTypesLoading(false); }
  };

  const loadMarkets = async () => {
    setMarketsLoading(true); setMarketsError(null);
    try { setMarkets(await getAllMarkets(domain)); }
    catch (e: any) { setMarketsError(e.message || 'Failed to load markets'); }
    finally { setMarketsLoading(false); }
  };

  const loadTemplates = async () => {
    setTemplatesLoading(true); setTemplatesError(null);
    try { setTemplates(await getTemplates(domain)); }
    catch (e: any) { setTemplatesError(e.message || 'Failed to load templates'); }
    finally { setTemplatesLoading(false); }
  };

  // ── Fetch branding docs from Veeva ──
  const handleFetchFromVeeva = async () => {
    setBrandingDocs([]);
    setBrandingDocsFetching(true); setBrandingDocsError(null); setBrandingFetchMsg(null);
    try {
      const { inserted, documents } = await fetchVeevaDocsFromVeeva(domain);
      setBrandingDocs(documents);
      setBrandingFetchMsg(
        inserted === 0
          ? 'Sync complete. No new documents found.'
          : `Sync complete. ${inserted} new document${inserted !== 1 ? 's' : ''} added.`
      );
    } catch (e: any) {
      setBrandingDocsError(e.message || 'Failed to fetch from Veeva');
    } finally {
      setBrandingDocsFetching(false);
    }
  };

  // ── Branding doc edit ──
  const openDocEdit = (doc: VeevaDocument) => {
    if (docTypes.length === 0) loadDocTypes();
    if (markets.length === 0) loadMarkets();
    if (brands.length === 0) fetchBrands();
    setDocEditError(null);
    setEditingDoc(doc);
    setDocEditForm({
      brand_id: doc.brand_id || '',
      document_type_id: doc.document_type_id ? String(doc.document_type_id) : '',
      market_id: doc.market_id ? String(doc.market_id) : '',
    });
  };

  const saveDocEdit = async () => {
    if (!editingDoc) return;
    setDocEditSaving(true); setDocEditError(null);
    try {
      const updated = await updateVeevaDoc(editingDoc.id, {
        brand_id: docEditForm.brand_id || null,
        document_type_id: docEditForm.document_type_id ? Number(docEditForm.document_type_id) : null,
        market_id: docEditForm.market_id ? Number(docEditForm.market_id) : null,
      });
      setBrandingDocs(prev => prev.map(d => d.id === updated.id ? updated : d));
      setEditingDoc(null);
    } catch (e: any) {
      setDocEditError(e.message || 'Failed to save changes');
    } finally {
      setDocEditSaving(false);
    }
  };

  // ── Brands CRUD ──
  const openAddBrandModal = () => {
    setEditingBrand(null); setBrandForm(emptyBrandForm); setLogoFile(null);
    setBrandSaveError(null); setBrandNameTouched(false); setShowBrandModal(true);
  };

  const openEditBrandModal = (brand: Brand) => {
    setEditingBrand(brand);
    setBrandForm({
      brand_name: brand.brand_name || '',
      primary_brand_color: brand.primary_brand_color || '',
      secondary_brand_color: brand.secondary_brand_color || '',
      color_palette: brand.color_palette || '',
      podcast_guidelines: brand.podcast_guidelines || '',
    });
    setLogoFile(null); setBrandSaveError(null); setBrandNameTouched(false); setShowBrandModal(true);
  };

  const closeBrandModal = () => { setShowBrandModal(false); setEditingBrand(null); };

  const handleBrandSave = async () => {
    setBrandNameTouched(true);
    if (!brandForm.brand_name.trim()) { setBrandSaveError('Brand name is required.'); return; }
    setBrandSaving(true); setBrandSaveError(null);
    try {
      const fd = new FormData();
      Object.entries(brandForm).forEach(([k, v]) => fd.append(k, v));
      if (logoFile) fd.append('brand_logo', logoFile);
      editingBrand ? await editBrand(editingBrand.brand_id, fd, domain) : await addBrand(fd, domain);
      closeBrandModal();
      fetchBrands();
    } catch (e: any) {
      setBrandSaveError(e.message || 'Failed to save brand');
    } finally {
      setBrandSaving(false);
    }
  };

  // ── Asset Types CRUD ──
  const openDocTypeModal = (dt?: DocumentType) => {
    setEditingDocType(dt || null);
    setDocTypeForm(dt?.name || '');
    setDocTypeModalError(null);
    setDocTypeFormTouched(false);
    setShowDocTypeModal(true);
  };

  const saveDocType = async () => {
    setDocTypeFormTouched(true);
    if (!docTypeForm.trim()) { setDocTypeModalError('Name is required.'); return; }
    setDocTypeSaving(true); setDocTypeModalError(null);
    try {
      if (editingDocType) {
        const updated = await editDocumentType(editingDocType.id, docTypeForm.trim(), domain);
        setDocTypes(prev => prev.map(x => x.id === updated.id ? updated : x));
      } else {
        const added = await addDocumentType(docTypeForm.trim(), domain);
        setDocTypes(prev => [...prev, added].sort((a, b) => a.name.localeCompare(b.name)));
      }
      setShowDocTypeModal(false);
    } catch (e: any) {
      setDocTypeModalError(e.message || 'Failed to save document type');
    } finally {
      setDocTypeSaving(false);
    }
  };

  // ── Markets CRUD ──
  const openMarketModal = (m?: Market) => {
    setEditingMarket(m || null);
    setMarketForm(m?.name || '');
    setMarketModalError(null);
    setMarketFormTouched(false);
    setShowMarketModal(true);
  };

  const saveMarket = async () => {
    setMarketFormTouched(true);
    if (!marketForm.trim()) { setMarketModalError('Name is required.'); return; }
    setMarketSaving(true); setMarketModalError(null);
    try {
      if (editingMarket) {
        const updated = await editMarket(editingMarket.id, marketForm.trim(), domain);
        setMarkets(prev => prev.map(x => x.id === updated.id ? updated : x));
      } else {
        const added = await addMarket(marketForm.trim(), domain);
        setMarkets(prev => [...prev, added].sort((a, b) => a.name.localeCompare(b.name)));
      }
      setShowMarketModal(false);
    } catch (e: any) {
      setMarketModalError(e.message || 'Failed to save market');
    } finally {
      setMarketSaving(false);
    }
  };

  // ── Templates CRUD ──
  const openTemplateModal = () => {
    setTemplateForm({ name: '', brand_id: '' });
    setTemplateReferences([]);
    setTemplateModalError(null);
    setTemplateFormTouched(false);
    setShowTemplateModal(true);
  };

  const handleTemplateFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newRefs = Array.from(files).map((file, i) => {
        return {
            layoutType: templateReferences.length === 0 && i === 0 ? 'master' : 'content',
            file: file,
            preview: URL.createObjectURL(file)
        };
    });
    setTemplateReferences(prev => [...prev, ...newRefs]);
    
    if (templateFileInputRef.current) {
        templateFileInputRef.current.value = '';
    }
  };

  const handleRemoveTemplateRef = (index: number) => {
    setTemplateReferences(prev => prev.filter((_, i) => i !== index));
  };

  const handleTemplateLayoutChange = (index: number, layoutType: string) => {
    setTemplateReferences(prev => prev.map((r, i) => i === index ? { ...r, layoutType } : r));
  };

  const saveTemplateHandler = async () => {
    setTemplateFormTouched(true);
    if (!templateForm.name.trim()) { setTemplateModalError('Template name is required.'); return; }
    if (!templateForm.brand_id) { setTemplateModalError('Brand is required.'); return; }
    if (templateReferences.length === 0) { setTemplateModalError('At least one reference image is required.'); return; }
    
    setTemplateSaving(true); setTemplateModalError(null);
    try {
      const added = await saveTemplate(domain, templateForm.name, templateForm.brand_id, templateReferences);
      setTemplates(prev => [...prev, added].sort((a, b) => a.name.localeCompare(b.name)));
      setShowTemplateModal(false);
    } catch (e: any) {
      setTemplateModalError(e.message || 'Failed to save template');
    } finally {
      setTemplateSaving(false);
    }
  };

  const handleDeleteTemplate = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this template?')) return;
    try {
      await deleteTemplate(id);
      setTemplates(prev => prev.filter(t => t.id !== id));
    } catch (e: any) {
      setTemplatesError(e.message || 'Failed to delete template');
    }
  };

  // ── Brands table helpers ──
  const logoFilename = (path?: string) => path ? (path.split(/[\\/]/).pop() || '—') : '—';

  const handleSort = (key: SortKey) => {
    sortKey === key ? setSortAsc(!sortAsc) : (setSortKey(key), setSortAsc(true));
    setPage(1);
  };

  const filtered = brands
    .filter(b => (b.brand_name || '').toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      const av = (a[sortKey] || '').toLowerCase(), bv = (b[sortKey] || '').toLowerCase();
      return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av);
    });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const filteredBrandingDocs = brandingDocs.filter(d =>
    (d.filename || '').toLowerCase().includes(brandingDocsSearch.toLowerCase()) ||
    (d.brand_name || '').toLowerCase().includes(brandingDocsSearch.toLowerCase())
  );
  const bdTotalPages = Math.max(1, Math.ceil(filteredBrandingDocs.length / PAGE_SIZE));
  const paginatedBrandingDocs = filteredBrandingDocs.slice((brandingDocsPage - 1) * PAGE_SIZE, brandingDocsPage * PAGE_SIZE);

  const filteredMarkets = markets.filter(m => m.name.toLowerCase().includes(marketSearch.toLowerCase()));
  const mktTotalPages = Math.max(1, Math.ceil(filteredMarkets.length / PAGE_SIZE));
  const paginatedMarkets = filteredMarkets.slice((marketPage - 1) * PAGE_SIZE, marketPage * PAGE_SIZE);

  const filteredDocTypes = docTypes.filter(dt => dt.name.toLowerCase().includes(docTypeSearch.toLowerCase()));
  const dtTotalPages = Math.max(1, Math.ceil(filteredDocTypes.length / PAGE_SIZE));
  const paginatedDocTypes = filteredDocTypes.slice((docTypePage - 1) * PAGE_SIZE, docTypePage * PAGE_SIZE);

  const SortIcon = ({ col }: { col: SortKey }) =>
    sortKey === col
      ? sortAsc ? <ArrowUp className="size-3 ml-1 inline" /> : <ArrowDown className="size-3 ml-1 inline" />
      : <span className="ml-1 inline-block w-3" />;

  if (domain === 'hls') {
    return (
      <div className='hls_domain'>
        <div className={"min-h-screen bg-linear-to-br from-white via-[#f9f9f9] to-white flex flex-col"}>
          <div className="flex flex-1 overflow-hidden">
            {/* ── Sidebar ── */}
            <aside className="w-56 bg-white border-r border-slate-100 flex flex-col shrink-0 shadow-sm">
              <div className="px-4 py-3 border-b border-slate-100">
                <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Configurations</div>
              </div>
              <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
                {sidebarItems.map(({ id, label, icon: Icon }) => (
                  <div
                    key={id}
                    onClick={() => { setActiveOption(id); setPage(1); setSearch(''); setDocTypeSearch(''); setDocTypePage(1); setMarketSearch(''); setMarketPage(1); setBrandingDocsSearch(''); setBrandingDocsPage(1); }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors text-left border-l-2 cursor-pointer ${activeOption === id ? 'text-[#2824be] border-[#2824be] bg-[#2824be]/10 font-semibold' : 'text-slate-600 border-transparent hover:bg-slate-50 hover:text-[#2824be]'} `}
                  >
                    <Icon className="size-4 shrink-0" />
                    <span className="truncate">{label}</span>
                  </div>
                ))}
              </nav>
            </aside>

            {/* ── Main Content ── */}
            <main className="flex-1 overflow-auto p-6">

              {/* ══ BRANDS ══ */}
              {activeOption === 'brands' && (
                <PanelWrapper>
                  <HlsPanelBar title="Brands">
                    <div className="flex-1 flex justify-center">
                      <div className="relative w-full max-w-sm">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-slate-400 pointer-events-none" />
                        <input
                          type="text" value={search}
                          onChange={e => { setSearch(e.target.value); setPage(1); }}
                          placeholder="Search by brand name…"
                          className="w-full bg-[#f9f9f9] text-slate-900 placeholder-slate-400 text-xs rounded-full pl-8 pr-4 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#2824be]/30 border border-[#e5e5e5]"
                        />
                      </div>
                    </div>
                    {domain == 'hls' && <div
                      onClick={() => { if (!brandDataFetching) handleBrandSync(); }}
                      className={`flex items-center gap-1.5 bg-white/20 hover:bg-white/30 text-white text-xs font-semibold px-4 py-1.5 rounded-full transition-colors whitespace-nowrap ${brandingDocsFetching ? 'opacity-60 pointer-events-none cursor-not-allowed' : 'cursor-pointer'}`}
                    >
                      {brandDataFetching
                        ? <><Loader2 size={13} className="animate-spin" /> Syncing…</>
                        : <><RefreshCw size={13} /> Sync from {domain}</>}
                    </div>}
                    {domain !== 'hls' && <div
                      onClick={openAddBrandModal} title="Add Brand"
                      className="size-8 rounded-full bg-[#2824be]/10 hover:bg-[#3a36d6]/10 border border-[#2824be]/20 flex items-center justify-center text-[#2824be] shrink-0 transition-colors cursor-pointer"
                    >
                      <Plus className="size-4 text-white" />
                    </div>}
                  </HlsPanelBar>

                  {brandsError && (
                    <div className="p-4 pb-0">
                      <AlertBanner type="error" message={brandsError} onDismiss={() => setBrandsError(null)} />
                    </div>
                  )}

                  {brandsLoading ? (
                    <LoadingState message="Loading brands…" />
                  ) : (
                    <>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-slate-100 bg-[#2824be]/5 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">
                              <th className="px-4 py-3 cursor-pointer select-none hover:text-[#2824be] whitespace-nowrap" onClick={() => handleSort('brand_name')}>
                                Brand Name <SortIcon col="brand_name" />
                              </th>
                              <th className="px-4 py-3 whitespace-nowrap">Logo File</th>
                              <th className="px-4 py-3 cursor-pointer select-none hover:text-[#2824be] whitespace-nowrap" onClick={() => handleSort('primary_brand_color')}>
                                Primary Color <SortIcon col="primary_brand_color" />
                              </th>
                              <th className="px-4 py-3 cursor-pointer select-none hover:text-[#2824be] whitespace-nowrap" onClick={() => handleSort('secondary_brand_color')}>
                                Secondary Color <SortIcon col="secondary_brand_color" />
                              </th>
                              <th className="px-4 py-3 text-center whitespace-nowrap sticky right-0 bg-[#2824be]/5 w-20">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {paginated.length === 0 ? (
                              <tr>
                                <td colSpan={5}>
                                  <EmptyState
                                    icon={Tag}
                                    title={search ? 'No brands match your search' : 'No brands yet'}
                                    subtitle={search ? 'Try a different search term' : 'Click + to add your first brand'}
                                  />
                                </td>
                              </tr>
                            ) : paginated.map((brand, idx) => (
                              <tr
                                key={brand.brand_id}
                                className={`group border-b border-slate-50 hover:bg-[#2824be]/5 transition-colors ${idx % 2 !== 0 ? 'bg-slate-50/40' : ''}`}
                              >
                                <td className="px-4 py-3 font-semibold text-slate-800 whitespace-nowrap">{brand.brand_name || '—'}</td>
                                <td className="px-4 py-3 whitespace-nowrap">
                                  {brand.brand_logo
                                    ? <span className="inline-flex items-center gap-1.5 text-xs text-slate-500"><Paperclip className="size-3 text-slate-400" />{logoFilename(brand.brand_logo)}</span>
                                    : <span className="text-slate-300">—</span>}
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap">
                                  {brand.primary_brand_color
                                    ? <span className="inline-flex items-center gap-2 text-xs text-slate-600"><span className="size-3.5 rounded border border-slate-200 shrink-0" style={{ backgroundColor: brand.primary_brand_color }} />{brand.primary_brand_color}</span>
                                    : <span className="text-slate-300">—</span>}
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap">
                                  {brand.secondary_brand_color
                                    ? <span className="inline-flex items-center gap-2 text-xs text-slate-600"><span className="size-3.5 rounded border border-slate-200 shrink-0" style={{ backgroundColor: brand.secondary_brand_color }} />{brand.secondary_brand_color}</span>
                                    : <span className="text-slate-300">—</span>}
                                </td>
                                <td className="px-4 py-3 text-center whitespace-nowrap sticky right-0 bg-white group-hover:bg-[#2824be]/5 transition-colors w-20">
                                  <div
                                    onClick={() => openEditBrandModal(brand)} title="Edit brand"
                                    className="inline-flex items-center justify-center size-7 rounded-md text-[#2824be] hover:bg-[#2824be]/10 transition-colors border border-transparent hover:border-[#2824be]/30 cursor-pointer"
                                  >
                                    <Pencil className="size-3.5" />
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Pagination */}
                      <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-slate-50/50">
                        <p className="text-xs text-slate-400">
                          {filtered.length === 0 ? 'No results' : `${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, filtered.length)} of ${filtered.length} brands`}
                        </p>
                        <div className="flex items-center gap-1">
                          <div onClick={() => { if (page > 1) setPage(p => Math.max(1, p - 1)); }} className={`size-7 flex items-center justify-center rounded border border-slate-200 transition-colors ${page === 1 ? 'opacity-40 pointer-events-none cursor-not-allowed text-slate-300' : 'cursor-pointer text-[#2824be] hover:bg-[#2824be]/10'}`}>
                            <ChevronLeft className="size-3.5" />
                          </div>
                          {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                            <div key={p} onClick={() => setPage(p)} className={`size-7 flex items-center justify-center rounded border text-xs font-medium transition-colors cursor-pointer ${p === page ? 'bg-[#2824be] border-[#2824be] text-white' : 'text-slate-500 border-slate-200 hover:bg-[#2824be]/10'}`}>{p}</div>
                          ))}
                          <div onClick={() => { if (page < totalPages) setPage(p => Math.min(totalPages, p + 1)); }} className={`size-7 flex items-center justify-center rounded border border-slate-200 transition-colors ${page === totalPages ? 'opacity-40 pointer-events-none cursor-not-allowed text-slate-300' : 'cursor-pointer text-[#2824be] hover:bg-[#2824be]/10'}`}>
                            <ChevronRight className="size-3.5" />
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </PanelWrapper>
              )}

              {/* ══ UPLOAD TO VEEVA ══ */}
              {activeOption === 'upload-to-veeva' && (
                <PanelWrapper>
                  <HlsPanelBar title="Upload to Veeva" />
                  <div className="p-8 max-w-lg mx-auto">
                    <p className="text-sm text-slate-500 mb-6 leading-relaxed">
                      Choose a document to upload directly to Veeva Vault. The document will be submitted and automatically set to <strong className="text-slate-700">Approved</strong> status.
                    </p>

                    {veevaResult && (
                      <AlertBanner
                        type={veevaResult.success ? 'success' : 'error'}
                        message={veevaResult.success ? (veevaResult.message || 'Upload successful') : (veevaResult.error || 'Upload failed')}
                        onDismiss={() => setVeevaResult(null)}
                      />
                    )}

                    {/* File picker */}
                    <div className="mb-4">
                      <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                        Document <span className="text-red-400">*</span>
                      </label>
                      <div
                        onClick={() => veevaFileRef.current?.click()}
                        className={`flex items-center gap-3 border-2 border-dashed rounded-lg px-4 py-4 cursor-pointer transition-colors ${veevaFileTouched && !veevaFile
                          ? 'border-red-300 bg-red-50'
                          : veevaFile
                            ? 'border-[#2824be]/40 bg-[#2824be]/5'
                            : 'border-[#e5e5e5] hover:border-[#2824be]/50 hover:bg-[#f9f9f9]'
                          }`}
                      >
                        <Upload size={18} className={veevaFile ? 'text-[#2824be]' : 'text-slate-400'} />
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm truncate font-medium ${veevaFile ? 'text-[#2824be]' : 'text-slate-400'}`}>
                            {veevaFile ? veevaFile.name : 'Click to choose a file…'}
                          </p>
                          <p className="text-xs text-slate-400 mt-0.5">PDF, Word, Text</p>
                        </div>
                        {veevaFile && (
                          <div
                            onClick={e => { e.stopPropagation(); setVeevaFile(null); setVeevaDocName(''); if (veevaFileRef.current) veevaFileRef.current.value = ''; }}
                            className="p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-400 transition-colors cursor-pointer"
                          >
                            <X size={14} />
                          </div>
                        )}
                      </div>
                      {veevaFileTouched && !veevaFile && (
                        <p className="text-xs text-red-500 mt-1 flex items-center gap-1"><AlertCircle size={11} /> Please select a file to upload.</p>
                      )}
                      <input ref={veevaFileRef} type="file" className="hidden" accept=".pdf,.doc,.docx,.txt"
                        onChange={e => {
                          const f = e.target.files?.[0] ?? null;
                          setVeevaFile(f); setVeevaFileTouched(true); setVeevaResult(null);
                          if (f && !veevaDocName) setVeevaDocName(f.name.replace(/\.[^.]+$/, ''));
                        }}
                      />
                    </div>

                    {/* Document name */}
                    <div className="mb-4">
                      <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                        Document Name <span className="text-slate-400 font-normal">(optional)</span>
                      </label>
                      <input
                        className={inputCls} placeholder="Defaults to filename"
                        value={veevaDocName} onChange={e => setVeevaDocName(e.target.value)}
                      />
                    </div>

                    {/* Metadata dropdowns */}
                    <div className="grid grid-cols-3 gap-3 mb-6">
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1.5">Brand</label>
                        <select className={inputCls} value={veevaBrandId} onChange={e => setVeevaBrandId(e.target.value)}>
                          <option value="">— Select —</option>
                          {brands.map(b => <option key={b.brand_id} value={b.brand_id}>{b.brand_name}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1.5">Asset Type</label>
                        <select className={inputCls} value={veevaDocTypeId} onChange={e => setVeevaDocTypeId(e.target.value)}>
                          <option value="">— Select —</option>
                          {docTypes.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1.5">Market</label>
                        <select className={inputCls} value={veevaMarketId} onChange={e => setVeevaMarketId(e.target.value)}>
                          <option value="">— Select —</option>
                          {markets.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                        </select>
                      </div>
                    </div>

                    <div
                      onClick={async () => {
                        if (veevaUploading) return;
                        setVeevaFileTouched(true);
                        if (!veevaFile) return;
                        setVeevaUploading(true); setVeevaResult(null);
                        try {
                          const result = await uploadToVeeva(veevaFile, domain, veevaDocName || undefined);
                          setVeevaResult(result);
                          if (result.success) {
                            try {
                              await createBrandingDoc({
                                document_unique_id: String(result.doc_id || ''),
                                version_id: result.version_id || null,
                                filename: result.filename || veevaFile.name,
                                name: veevaDocName || veevaFile.name.replace(/\.[^.]+$/, ''),
                                status: result.approved ? 'Approved' : 'Pending',
                                brand_id: veevaBrandId || null,
                                document_type_id: veevaDocTypeId ? Number(veevaDocTypeId) : null,
                                market_id: veevaMarketId ? Number(veevaMarketId) : null,
                                domain: domain,
                              });
                            } catch (_) { /* DB save failed silently — Veeva upload succeeded */ }
                            setVeevaFile(null); setVeevaDocName(''); setVeevaFileTouched(false);
                            setVeevaBrandId(''); setVeevaDocTypeId(''); setVeevaMarketId('');
                            if (veevaFileRef.current) veevaFileRef.current.value = '';
                          }
                        } catch (err: unknown) {
                          setVeevaResult({ success: false, error: err instanceof Error ? err.message : 'Upload failed' });
                        } finally {
                          setVeevaUploading(false);
                        }
                      }}
                      className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-white text-sm font-semibold transition-opacity shadow-sm ${veevaUploading ? 'bg-slate-300 pointer-events-none cursor-not-allowed' : 'bg-[#2824be] hover:bg-[#3a36d6] cursor-pointer'}`}
                    >
                      {veevaUploading
                        ? <><Loader2 size={15} className="animate-spin" /> Uploading…</>
                        : <><CloudUpload size={15} /> Upload to Veeva</>}
                    </div>
                  </div>
                </PanelWrapper>
              )}

              {/* ══ BRANDING DOCUMENTS ══ */}
              {activeOption === 'branding-documents' && (
                <PanelWrapper>
                  <HlsPanelBar title="Branding Documents">
                    <div className="flex-1 flex justify-center">
                      <div className="relative w-full max-w-sm">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-slate-400 pointer-events-none" />
                        <input
                          type="text" value={brandingDocsSearch}
                          onChange={e => { setBrandingDocsSearch(e.target.value); setBrandingDocsPage(1); }}
                          placeholder="Search by filename or brand…"
                          className="w-full bg-[#f9f9f9] text-slate-900 placeholder-slate-400 text-xs rounded-full pl-8 pr-4 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#2824be]/30 border border-[#e5e5e5]"
                        />
                      </div>
                    </div>
                    <div
                      onClick={() => { if (!brandingDocsFetching) handleFetchFromVeeva(); }}
                      className={`flex items-center gap-1.5 bg-white/20 hover:bg-white/30 text-white text-xs font-semibold px-4 py-1.5 rounded-full transition-colors whitespace-nowrap ${brandingDocsFetching ? 'opacity-60 pointer-events-none cursor-not-allowed' : 'cursor-pointer'}`}
                    >
                      {brandingDocsFetching
                        ? <><Loader2 size={13} className="animate-spin" /> Syncing…</>
                        : <><RefreshCw size={13} /> Sync from Veeva</>}
                    </div>
                  </HlsPanelBar>

                  {(brandingFetchMsg || brandingDocsError) && (
                    <div className="p-4 pb-0">
                      {brandingFetchMsg && <AlertBanner type="success" message={brandingFetchMsg} onDismiss={() => setBrandingFetchMsg(null)} />}
                      {brandingDocsError && <AlertBanner type="error" message={brandingDocsError} onDismiss={() => setBrandingDocsError(null)} />}
                    </div>
                  )}

                  {brandingDocsLoading ? (
                    <LoadingState message="Loading documents…" />
                  ) : (
                    <>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-slate-100 bg-[#2824be]/5 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">
                              <th className="px-4 py-3">Filename</th>
                              <th className="px-4 py-3">Status</th>
                              <th className="px-4 py-3">Brand</th>
                              <th className="px-4 py-3">Asset Type</th>
                              <th className="px-4 py-3">Market</th>
                              <th className="px-4 py-3 text-center sticky right-0 bg-[#2824be]/5 w-20">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {paginatedBrandingDocs.length === 0 ? (
                              <tr>
                                <td colSpan={6}>
                                  <EmptyState
                                    icon={FileText}
                                    title={brandingDocsSearch ? 'No documents match your search' : 'No documents synced yet'}
                                    subtitle={brandingDocsSearch ? 'Try a different search term' : 'Click "Sync from Veeva" to pull your approved documents'}
                                  />
                                </td>
                              </tr>
                            ) : paginatedBrandingDocs.map((doc, idx) => (
                              <tr key={doc.id} className={`group border-b border-slate-50 hover:bg-[#2824be]/5 transition-colors ${idx % 2 !== 0 ? 'bg-slate-50/40' : ''}`}>
                                <td className="px-4 py-3 text-slate-500 text-xs max-w-44 truncate" title={doc.filename || ''}>
                                  {doc.filename ? <span className="inline-flex items-center gap-1"><Paperclip size={11} />{doc.filename}</span> : '—'}
                                </td>
                                <td className="px-4 py-3">
                                  <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${doc.status?.toLowerCase() === 'approved' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                                    {doc.status || '—'}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-sm text-slate-600">{doc.brand_name || <span className="text-slate-300 text-xs">Not set</span>}</td>
                                <td className="px-4 py-3 text-sm text-slate-600">{doc.document_type_name || <span className="text-slate-300 text-xs">Not set</span>}</td>
                                <td className="px-4 py-3 text-sm text-slate-600">{doc.market_name || <span className="text-slate-300 text-xs">Not set</span>}</td>
                                <td className="px-4 py-3 text-center whitespace-nowrap sticky right-0 bg-white group-hover:bg-[#2824be]/5 transition-colors w-20">
                                  <div onClick={() => openDocEdit(doc)} title="Edit metadata" className="inline-flex items-center justify-center size-7 rounded-md text-[#2824be] hover:bg-[#2824be]/10 border border-[#2824be]/30 transition-colors cursor-pointer">
                                    <Pencil size={13} />
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Pagination */}
                      <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-slate-50/50">
                        <div className="text-xs text-slate-400">
                          {filteredBrandingDocs.length === 0 ? 'No results' : `${(brandingDocsPage - 1) * PAGE_SIZE + 1}–${Math.min(brandingDocsPage * PAGE_SIZE, filteredBrandingDocs.length)} of ${filteredBrandingDocs.length} documents`}
                        </div>
                        <div className="flex items-center gap-1">
                          <div onClick={() => { if (brandingDocsPage > 1) setBrandingDocsPage(p => Math.max(1, p - 1)); }} className={`size-7 flex items-center justify-center rounded border border-slate-200 transition-colors ${brandingDocsPage === 1 ? 'opacity-40 pointer-events-none cursor-not-allowed text-slate-300' : 'cursor-pointer text-[#2824be] hover:bg-[#2824be]/10'}`}>
                            <ChevronLeft className="size-3.5" />
                          </div>
                          {Array.from({ length: bdTotalPages }, (_, i) => i + 1).map(p => (
                            <div key={p} onClick={() => setBrandingDocsPage(p)} className={`size-7 flex items-center justify-center rounded border text-xs font-medium transition-colors cursor-pointer ${p === brandingDocsPage ? 'bg-[#2824be] border-[#2824be] text-white' : 'text-slate-500 border-slate-200 hover:bg-[#2824be]/10'}`}>{p}</div>
                          ))}
                          <div onClick={() => { if (brandingDocsPage < bdTotalPages) setBrandingDocsPage(p => Math.min(bdTotalPages, p + 1)); }} className={`size-7 flex items-center justify-center rounded border border-slate-200 transition-colors ${brandingDocsPage === bdTotalPages ? 'opacity-40 pointer-events-none cursor-not-allowed text-slate-300' : 'cursor-pointer text-[#2824be] hover:bg-[#2824be]/10'}`}>
                            <ChevronRight className="size-3.5" />
                          </div>
                        </div>
                      </div>
                    </>
                  )}

                  {/* Edit metadata modal */}
                  {editingDoc && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
                        <div className="flex items-center justify-between px-5 py-3.5 bg-[#2824be]">
                          <div>
                            <div className="text-base font-semibold text-white leading-tight">Edit Document Metadata</div>
                            <div className="text-white/70 text-xs mt-0.5 truncate max-w-72">{editingDoc.name}</div>
                          </div>
                          <div onClick={() => setEditingDoc(null)} className="text-white/80 hover:text-white p-1 rounded hover:bg-white/20 transition-colors cursor-pointer"><X size={18} /></div>
                        </div>
                        <div className="p-5 space-y-4">
                          {docEditError && <AlertBanner type="error" message={docEditError} onDismiss={() => setDocEditError(null)} />}
                          <div>
                            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Brand</label>
                            <select className={inputCls} value={docEditForm.brand_id} onChange={e => setDocEditForm(f => ({ ...f, brand_id: e.target.value }))}>
                              <option value="">— Select Brand —</option>
                              {brands.map(b => <option key={b.brand_id} value={b.brand_id}>{b.brand_name || b.brand_id}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Asset Type</label>
                            <select className={inputCls} value={docEditForm.document_type_id} onChange={e => setDocEditForm(f => ({ ...f, document_type_id: e.target.value }))}>
                              <option value="">— Select Asset Type —</option>
                              {docTypes.map(dt => <option key={dt.id} value={String(dt.id)}>{dt.name}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Market</label>
                            <select className={inputCls} value={docEditForm.market_id} onChange={e => setDocEditForm(f => ({ ...f, market_id: e.target.value }))}>
                              <option value="">— Select Market —</option>
                              {markets.map(m => <option key={m.id} value={String(m.id)}>{m.name}</option>)}
                            </select>
                          </div>
                        </div>
                        <div className="flex justify-end gap-2 px-5 py-4 border-t border-slate-100">
                          <div onClick={() => setEditingDoc(null)} className="px-4 py-2 rounded-lg text-sm text-slate-600 border border-slate-200 hover:bg-slate-50 transition-colors cursor-pointer">Cancel</div>
                          <div onClick={() => { if (!docEditSaving) saveDocEdit(); }} className={`flex items-center gap-2 px-5 py-2 rounded-lg text-white text-sm font-semibold transition-opacity ${docEditSaving ? 'opacity-60 pointer-events-none cursor-not-allowed' : 'bg-[#2824be] hover:bg-[#3a36d6] cursor-pointer'}`}>
                            {docEditSaving ? <><Loader2 size={14} className="animate-spin" /> Saving…</> : 'Save Changes'}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </PanelWrapper>
              )}

              {/* ══ CHAT HISTORY ══ */}
              {activeOption === 'chat-history' && (
                <PanelWrapper>
                  <HlsPanelBar title="Chat History" />
                  <div className="p-6">
                    {chatError && <AlertBanner type="error" message={chatError} onDismiss={() => setChatError(null)} />}
                    {chatLoading ? (
                      <LoadingState message="Loading chat history…" />
                    ) : chatHistory.length === 0 ? (
                      <EmptyState icon={FileText} title="No chat history" subtitle="No chatbot conversations recorded yet." />
                    ) : (
                      <>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-slate-100 bg-[#2824be]/5 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">
                                <th className="px-4 py-3">Session ID</th>
                                <th className="px-4 py-3">User</th>
                                <th className="px-4 py-3">IP Address</th>
                                <th className="px-4 py-3">Timestamp</th>
                                <th className="px-4 py-3">Adverse Event Detected</th>
                                <th className="px-4 py-3">History</th>
                              </tr>
                            </thead>
                            <tbody>
                              {chatHistory.map((c, idx) => {
                                const turns: { role: string; content: string }[] = (() => {
                                  try { return c.chat_history ? JSON.parse(c.chat_history) : []; }
                                  catch { return []; }
                                })();
                                const isExpanded = expandedChatRow === (c.id || idx);
                                return (
                                  <>
                                    <tr key={c.id || idx} className={`group border-b border-slate-50 hover:bg-[#2824be]/5 transition-colors ${idx % 2 !== 0 ? 'bg-slate-50/40' : ''}`}>
                                      <td className="px-4 py-3 font-mono text-[11px] text-slate-500 max-w-[160px] truncate" title={c.session_uuid || ''}>{c.session_uuid || '—'}</td>
                                      <td className="px-4 py-3">{c.user_name || '—'}</td>
                                      <td className="px-4 py-3">{c.ipaddress || '—'}</td>
                                      <td className="px-4 py-3 whitespace-nowrap">{c.timestamp || '—'}</td>
                                      <td className="px-4 py-3">{c.adverse_event ? "Yes" : "No"}</td>
                                      <td className="px-4 py-3">
                                        {turns.length > 0 ? (
                                          <button
                                            onClick={() => setExpandedChatRow(isExpanded ? null : (c.id || idx))}
                                            className="text-[11px] font-medium text-[#2824be] hover:underline"
                                          >
                                            {isExpanded ? 'Hide' : `View (${Math.floor(turns.length / 2)} msg${turns.length / 2 !== 1 ? 's' : ''})`}
                                          </button>
                                        ) : '—'}
                                      </td>
                                    </tr>
                                    {isExpanded && turns.length > 0 && (
                                      <tr key={`${c.id || idx}-detail`} className="bg-slate-50/60 border-b border-slate-100">
                                        <td colSpan={5} className="px-6 py-4">
                                          <div className="flex flex-col gap-2 max-h-64 overflow-y-auto pr-1">
                                            {turns.map((t, ti) => (
                                              <div key={ti} className={`flex gap-2 ${t.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                                <div className={`rounded-lg px-3 py-2 text-xs max-w-[75%] whitespace-pre-wrap break-words ${t.role === 'user' ? 'bg-[#2824be] text-white' : 'bg-white border border-slate-200 text-slate-700'}`}>
                                                  <span className={`block text-[10px] font-semibold mb-0.5 ${t.role === 'user' ? 'text-blue-200' : 'text-slate-400'}`}>{t.role === 'user' ? 'User' : 'Assistant'}</span>
                                                  {t.content}
                                                </div>
                                              </div>
                                            ))}
                                          </div>
                                        </td>
                                      </tr>
                                    )}
                                  </>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>

                        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-slate-50/50 mt-4">
                          <p className="text-xs text-slate-400">{`${(chatPage - 1) * PAGE_SIZE + 1}–${Math.min(chatPage * PAGE_SIZE, chatTotal)} of ${chatTotal}`}</p>
                          <div className="flex items-center gap-1">
                            <div onClick={() => { if (chatPage > 1) setChatPage(p => Math.max(1, p - 1)); }} className={`size-7 flex items-center justify-center rounded border border-slate-200 transition-colors ${chatPage === 1 ? 'opacity-40 pointer-events-none cursor-not-allowed' : 'cursor-pointer text-[#2824be] hover:bg-[#2824be]/10'}`}>
                              <ChevronLeft className="size-3.5" />
                            </div>
                            {Array.from({ length: chatTotalPages }, (_, i) => i + 1).map(p => (
                              <div key={p} onClick={() => setChatPage(p)} className={`size-7 flex items-center justify-center rounded border text-xs font-medium transition-colors cursor-pointer ${p === chatPage ? 'bg-[#2824be] border-[#2824be] text-white' : 'text-slate-500 border-slate-200 hover:bg-[#2824be]/10'}`}>{p}</div>
                            ))}
                            <div onClick={() => { if (chatPage < chatTotalPages) setChatPage(p => Math.min(chatTotalPages, p + 1)); }} className={`size-7 flex items-center justify-center rounded border border-slate-200 transition-colors ${chatPage === chatTotalPages ? 'opacity-40 pointer-events-none cursor-not-allowed' : 'cursor-pointer text-[#2824be] hover:bg-[#2824be]/10'}`}>
                              <ChevronRight className="size-3.5" />
                            </div>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </PanelWrapper>
              )}

              {/* ══ DOCUMENT TYPES ══ */}
              {activeOption === 'document-types' && (
                <PanelWrapper>
                  <HlsPanelBar title="Asset Types">
                    <div className="flex-1 flex justify-center">
                      <div className="relative w-full max-w-sm">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-slate-400 pointer-events-none" />
                        <input
                          type="text" value={docTypeSearch}
                          onChange={e => { setDocTypeSearch(e.target.value); setDocTypePage(1); }}
                          placeholder="Search by name…"
                          className="w-full bg-[#f9f9f9] text-slate-900 placeholder-slate-400 text-xs rounded-full pl-8 pr-4 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#2824be]/30 border border-[#e5e5e5]"
                        />
                      </div>
                    </div>
                    <div
                      onClick={() => openDocTypeModal()} title="Add Asset Type"
                      className="size-8 rounded-full bg-[#2824be]/10 hover:bg-[#3a36d6]/10 border border-[#2824be]/20 flex items-center justify-center text-[#2824be] shrink-0 transition-colors cursor-pointer"
                    >
                      <Plus className="size-4 text-white" />
                    </div>
                  </HlsPanelBar>

                  {docTypesError && (
                    <div className="p-4 pb-0">
                      <AlertBanner type="error" message={docTypesError} onDismiss={() => setDocTypesError(null)} />
                    </div>
                  )}

                  {docTypesLoading ? (
                    <LoadingState message="Loading asset types…" />
                  ) : (
                    <>
                      <div className="overflow-x-auto">
                        <table className="text-sm">
                          <thead>
                            <tr className="border-b border-slate-100 bg-[#2824be]/5 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">
                              <th className="px-4 py-3 min-w-50">Name</th>
                              <th className="px-4 py-3 text-center w-20">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {paginatedDocTypes.length === 0 ? (
                              <tr><td colSpan={2}><EmptyState icon={Layers} title={docTypeSearch ? 'No asset types match your search' : 'No asset types yet'} subtitle={docTypeSearch ? 'Try a different search term' : 'Click + to add your first asset type'} /></td></tr>
                            ) : paginatedDocTypes.map((dt, idx) => (
                              <tr key={dt.id} className={`group border-b border-slate-50 hover:bg-[#2824be]/5 transition-colors ${idx % 2 !== 0 ? 'bg-slate-50/40' : ''}`}>
                                <td className="px-4 py-3 font-semibold text-slate-800 whitespace-nowrap">{dt.name}</td>
                                <td className="px-4 py-3 text-center w-20">
                                  <div onClick={() => openDocTypeModal(dt)} title="Edit asset type" className="inline-flex items-center justify-center size-7 rounded-md text-[#2824be] hover:bg-[#2824be]/10 transition-colors border border-transparent hover:border-[#2824be]/30 cursor-pointer">
                                    <Pencil className="size-3.5" />
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Pagination */}
                      <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-slate-50/50">
                        <div className="text-xs text-slate-400">
                          {filteredDocTypes.length === 0 ? 'No results' : `${(docTypePage - 1) * PAGE_SIZE + 1}–${Math.min(docTypePage * PAGE_SIZE, filteredDocTypes.length)} of ${filteredDocTypes.length} asset types`}
                        </div>
                        <div className="flex items-center gap-1">
                          <div onClick={() => { if (docTypePage > 1) setDocTypePage(p => Math.max(1, p - 1)); }} className={`size-7 flex items-center justify-center rounded border border-slate-200 transition-colors ${docTypePage === 1 ? 'opacity-40 pointer-events-none cursor-not-allowed text-slate-300' : 'cursor-pointer text-[#2824be] hover:bg-[#2824be]/10'}`}>
                            <ChevronLeft className="size-3.5" />
                          </div>
                          {Array.from({ length: dtTotalPages }, (_, i) => i + 1).map(p => (
                            <div key={p} onClick={() => setDocTypePage(p)} className={`size-7 flex items-center justify-center rounded border text-xs font-medium transition-colors cursor-pointer ${p === docTypePage ? 'bg-[#2824be] border-[#2824be] text-white' : 'text-slate-500 border-slate-200 hover:bg-[#2824be]/10'}`}>{p}</div>
                          ))}
                          <div onClick={() => { if (docTypePage < dtTotalPages) setDocTypePage(p => Math.min(dtTotalPages, p + 1)); }} className={`size-7 flex items-center justify-center rounded border border-slate-200 transition-colors ${docTypePage === dtTotalPages ? 'opacity-40 pointer-events-none cursor-not-allowed text-slate-300' : 'cursor-pointer text-[#2824be] hover:bg-[#2824be]/10'}`}>
                            <ChevronRight className="size-3.5" />
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </PanelWrapper>
              )}

              {/* ══ MARKETS ══ */}
              {activeOption === 'markets' && (
                <PanelWrapper>
                  <HlsPanelBar title="Markets">
                    <div className="flex-1 flex justify-center">
                      <div className="relative w-full max-w-sm">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-slate-400 pointer-events-none" />
                        <input
                          type="text" value={marketSearch}
                          onChange={e => { setMarketSearch(e.target.value); setMarketPage(1); }}
                          placeholder="Search by name…"
                          className="w-full bg-[#f9f9f9] text-slate-900 placeholder-slate-400 text-xs rounded-full pl-8 pr-4 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#2824be]/30 border border-[#e5e5e5]"
                        />
                      </div>
                    </div>
                    <div
                      onClick={() => openMarketModal()} title="Add Market"
                      className="size-8 rounded-full bg-[#2824be]/10 hover:bg-[#3a36d6]/10 border border-[#2824be]/20 flex items-center justify-center text-[#2824be] shrink-0 transition-colors cursor-pointer"
                    >
                      <Plus className="size-4 text-white" />
                    </div>
                  </HlsPanelBar>

                  {marketsError && (
                    <div className="p-4 pb-0">
                      <AlertBanner type="error" message={marketsError} onDismiss={() => setMarketsError(null)} />
                    </div>
                  )}

                  {marketsLoading ? (
                    <LoadingState message="Loading markets…" />
                  ) : (
                    <>
                      <div className="overflow-x-auto">
                        <table className="text-sm">
                          <thead>
                            <tr className="border-b border-slate-100 bg-[#2824be]/5 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">
                              <th className="px-4 py-3 min-w-50">Name</th>
                              <th className="px-4 py-3 text-center w-20">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {paginatedMarkets.length === 0 ? (
                              <tr><td colSpan={2}><EmptyState icon={Globe} title={marketSearch ? 'No markets match your search' : 'No markets yet'} subtitle={marketSearch ? 'Try a different search term' : 'Click + to add your first market'} /></td></tr>
                            ) : paginatedMarkets.map((m, idx) => (
                              <tr key={m.id} className={`group border-b border-slate-50 hover:bg-[#2824be]/5 transition-colors ${idx % 2 !== 0 ? 'bg-slate-50/40' : ''}`}>
                                <td className="px-4 py-3 font-semibold text-slate-800 whitespace-nowrap">{m.name}</td>
                                <td className="px-4 py-3 text-center w-20">
                                  <div onClick={() => openMarketModal(m)} title="Edit market" className="inline-flex items-center justify-center size-7 rounded-md text-[#2824be] hover:bg-[#2824be]/10 transition-colors border border-transparent hover:border-[#2824be]/30 cursor-pointer">
                                    <Pencil className="size-3.5" />
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Pagination */}
                      <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-slate-50/50">
                        <div className="text-xs text-slate-400">
                          {filteredMarkets.length === 0 ? 'No results' : `${(marketPage - 1) * PAGE_SIZE + 1}–${Math.min(marketPage * PAGE_SIZE, filteredMarkets.length)} of ${filteredMarkets.length} markets`}
                        </div>
                        <div className="flex items-center gap-1">
                          <div onClick={() => { if (marketPage > 1) setMarketPage(p => Math.max(1, p - 1)); }} className={`size-7 flex items-center justify-center rounded border border-slate-200 transition-colors ${marketPage === 1 ? 'opacity-40 pointer-events-none cursor-not-allowed text-slate-300' : 'cursor-pointer text-[#2824be] hover:bg-[#2824be]/10'}`}>
                            <ChevronLeft className="size-3.5" />
                          </div>
                          {Array.from({ length: mktTotalPages }, (_, i) => i + 1).map(p => (
                            <div key={p} onClick={() => setMarketPage(p)} className={`size-7 flex items-center justify-center rounded border text-xs font-medium transition-colors cursor-pointer ${p === marketPage ? 'bg-[#2824be] border-[#2824be] text-white' : 'text-slate-500 border-slate-200 hover:bg-[#2824be]/10'}`}>{p}</div>
                          ))}
                          <div onClick={() => { if (marketPage < mktTotalPages) setMarketPage(p => Math.min(mktTotalPages, p + 1)); }} className={`size-7 flex items-center justify-center rounded border border-slate-200 transition-colors ${marketPage === mktTotalPages ? 'opacity-40 pointer-events-none cursor-not-allowed text-slate-300' : 'cursor-pointer text-[#2824be] hover:bg-[#2824be]/10'}`}>
                            <ChevronRight className="size-3.5" />
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </PanelWrapper>
              )}
            </main>
          </div>

          {/* ══ Asset Type Modal ══ */}
          {showDocTypeModal && (
            <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden">
                <div className='flex w-full justify-between items-center bg-[var(--hls-primary)] px-5 py-3.5'>
                  <div className="text-base font-semibold text-white leading-tight">{editingDocType ? 'Edit Asset Type' : 'Add Asset Type'}</div>
                  <div onClick={() => setShowDocTypeModal(false)} className="text-white/80 hover:text-white p-1 rounded hover:bg-white/20 transition-colors cursor-pointer"><X size={18} /></div>
                </div>
                <div className="p-5 space-y-3">
                  {docTypeModalError && <AlertBanner type="error" message={docTypeModalError} onDismiss={() => setDocTypeModalError(null)} />}
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">Name <span className="text-red-400">*</span></label>
                    <input
                      className={docTypeFormTouched && !docTypeForm.trim() ? inputErrCls : inputCls}
                      value={docTypeForm}
                      onChange={e => { setDocTypeForm(e.target.value); setDocTypeFormTouched(true); if (e.target.value.trim()) setDocTypeModalError(null); }}
                      placeholder="e.g. Press Release"
                      autoFocus
                    />
                    {docTypeFormTouched && !docTypeForm.trim() && (
                      <p className="text-xs text-red-500 mt-1 flex items-center gap-1"><AlertCircle size={11} /> Name is required.</p>
                    )}
                  </div>
                </div>
                <div className="flex justify-end gap-2 px-5 py-4 border-t border-slate-100">
                  <div onClick={() => setShowDocTypeModal(false)} className="px-4 py-2 rounded-lg text-sm text-slate-600 border border-slate-200 hover:bg-slate-50 transition-colors cursor-pointer">Cancel</div>
                  <div
                    onClick={() => { if (!docTypeSaving) saveDocType(); }}
                    className={`flex items-center gap-2 px-5 py-2 rounded-lg text-white text-sm font-semibold transition-opacity whitespace-nowrap ${docTypeSaving ? 'opacity-60 pointer-events-none cursor-not-allowed' : 'bg-[#2824be] hover:bg-[#3a36d6] cursor-pointer'}`}
                  >
                    {docTypeSaving ? <><Loader2 size={14} className="animate-spin" /> Saving…</> : (editingDocType ? 'Save Changes' : 'Add Asset Type')}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ══ Market Modal ══ */}
          {showMarketModal && (
            <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3.5 bg-[#2824be]">
                  <div className="text-base font-semibold text-white leading-tight">{editingMarket ? 'Edit Market' : 'Add Market'}</div>
                  <div onClick={() => setShowMarketModal(false)} className="text-white/80 hover:text-white p-1 rounded hover:bg-white/20 transition-colors cursor-pointer"><X size={18} /></div>
                </div>
                <div className="p-5 space-y-3">
                  {marketModalError && <AlertBanner type="error" message={marketModalError} onDismiss={() => setMarketModalError(null)} />}
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">Name <span className="text-red-400">*</span></label>
                    <input
                      className={marketFormTouched && !marketForm.trim() ? inputErrCls : inputCls}
                      value={marketForm}
                      onChange={e => { setMarketForm(e.target.value); setMarketFormTouched(true); if (e.target.value.trim()) setMarketModalError(null); }}
                      placeholder="e.g. United States"
                      autoFocus
                    />
                    {marketFormTouched && !marketForm.trim() && (
                      <p className="text-xs text-red-500 mt-1 flex items-center gap-1"><AlertCircle size={11} /> Name is required.</p>
                    )}
                  </div>
                </div>
                <div className="flex justify-end gap-2 px-5 py-4 border-t border-slate-100">
                  <div onClick={() => setShowMarketModal(false)} className="px-4 py-2 rounded-lg text-sm text-slate-600 border border-slate-200 hover:bg-slate-50 transition-colors cursor-pointer">Cancel</div>
                  <div
                    onClick={() => { if (!marketSaving) saveMarket(); }}
                    className={`flex items-center gap-2 px-5 py-2 rounded-lg text-white text-sm font-semibold transition-opacity whitespace-nowrap ${marketSaving ? 'opacity-60 pointer-events-none cursor-not-allowed bg-slate-300' : 'bg-[#2824be] hover:bg-[#3a36d6] cursor-pointer'}`}
                  >
                    {marketSaving ? <><Loader2 size={14} className="animate-spin" /> Saving…</> : (editingMarket ? 'Save Changes' : 'Add Market')}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ══ Add / Edit Brand Modal ══ */}
          {showBrandModal && (
            <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3.5 bg-[#2824be]">
                  <div>
                    <div className="text-base font-semibold text-white leading-tight">{editingBrand ? 'Edit Brand' : 'Add New Brand'}</div>
                    <div className="text-xs text-white/70 mt-0.5">{editingBrand ? 'Update brand details below' : 'Fill in the details to create a new brand'}</div>
                  </div>
                  <div onClick={closeBrandModal} className="p-1.5 rounded hover:bg-white/20 text-white transition-colors cursor-pointer"><X className="size-4" /></div>
                </div>

                <div className="px-6 py-5 space-y-4 max-h-[60vh] overflow-y-auto">
                  {brandSaveError && <AlertBanner type="error" message={brandSaveError} onDismiss={() => setBrandSaveError(null)} />}

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">Brand Name <span className="text-red-400">*</span></label>
                    <input
                      type="text" value={brandForm.brand_name}
                      onChange={e => { setBrandForm({ ...brandForm, brand_name: e.target.value }); setBrandNameTouched(true); if (e.target.value.trim()) setBrandSaveError(null); }}
                      className={brandNameTouched && !brandForm.brand_name.trim() ? inputErrCls : inputCls}
                      placeholder="e.g. Molina Healthcare"
                    />
                    {brandNameTouched && !brandForm.brand_name.trim() && (
                      <p className="text-xs text-red-500 mt-1 flex items-center gap-1"><AlertCircle size={11} /> Brand name is required.</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">Brand Logo</label>
                    <div className="flex items-center gap-3">
                      <div onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-[#2824be] border border-[#2824be]/50 rounded-lg hover:bg-[#2824be]/5 transition-colors cursor-pointer">
                        <Paperclip className="size-3.5" /> Choose File
                      </div>
                      <span className="text-xs text-slate-500 truncate max-w-60">
                        {logoFile ? logoFile.name : editingBrand?.brand_logo ? logoFilename(editingBrand.brand_logo) : <span className="text-slate-400">No file chosen</span>}
                      </span>
                    </div>
                    <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={e => setLogoFile(e.target.files?.[0] || null)} />
                    <p className="text-xs text-slate-400 mt-1">Accepted: PNG, JPG, JPEG, GIF, SVG, WebP</p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">Primary Brand Color</label>
                    <div className="flex items-center gap-2">
                      <input type="color" value={brandForm.primary_brand_color || '#53A2FF'} onChange={e => setBrandForm({ ...brandForm, primary_brand_color: e.target.value })} className="size-8 rounded-lg border border-slate-200 cursor-pointer p-0.5 shrink-0" />
                      <input type="text" value={brandForm.primary_brand_color} onChange={e => setBrandForm({ ...brandForm, primary_brand_color: e.target.value })} className={inputCls} placeholder="Choose Primary Brand Color" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">Secondary Brand Color</label>
                    <div className="flex items-center gap-2">
                      <input type="color" value={brandForm.secondary_brand_color || '#a855f7'} onChange={e => setBrandForm({ ...brandForm, secondary_brand_color: e.target.value })} className="size-8 rounded-lg border border-slate-200 cursor-pointer p-0.5 shrink-0" />
                      <input type="text" value={brandForm.secondary_brand_color} onChange={e => setBrandForm({ ...brandForm, secondary_brand_color: e.target.value })} className={inputCls} placeholder="Choose Secondary Brand Color" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">Color Palette</label>
                    <textarea value={brandForm.color_palette} onChange={e => setBrandForm({ ...brandForm, color_palette: e.target.value })} rows={3} className={`${inputCls} resize-none`} placeholder="Describe the brand color palette…" />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">Podcast Guidelines</label>
                    <textarea value={brandForm.podcast_guidelines} onChange={e => setBrandForm({ ...brandForm, podcast_guidelines: e.target.value })} rows={3} className={`${inputCls} resize-none`} placeholder="Enter podcast guidelines and tone of voice…" />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-slate-50/50 rounded-b-xl">
                  <div onClick={closeBrandModal} className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer">Cancel</div>
                  <div onClick={() => { if (!brandSaving) handleBrandSave(); }} className={`flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white rounded-lg shadow-sm transition-opacity whitespace-nowrap ${brandSaving ? 'opacity-60 pointer-events-none cursor-not-allowed bg-slate-300' : 'bg-[#2824be] hover:bg-[#3a36d6] cursor-pointer'}`}>
                    {brandSaving && <Loader2 className="size-4 animate-spin" />}
                    {editingBrand ? 'Save Changes' : 'Add Brand'}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    )
  };

  return (
    <div className={"min-h-screen bg-linear-to-br from-[#E8F4FF] via-white to-[#F0F8FF] flex flex-col " + domain === 'hls' ? 'h-[91vw]' : ''}>
      <Header
        user={user}
        onLogout={onLogout}
        onAdminClick={onAdminClick}
        onPersonalizationClick={onPersonalizationClick}
        onPersonalizeContentClick={onPersonalizeContentClick}
        onConfigurationClick={onConfigurationClick}
        onWorkflowClick={onWorkflowClick}

        onLogoClick={onBack}
        currentView="dashboard"
      />
      <div className="flex flex-1 overflow-hidden">
        {/* ── Sidebar ── */}
        <aside className="w-56 bg-white border-r border-slate-100 flex flex-col shrink-0 shadow-sm">
          <div className="px-4 py-3 border-b border-slate-100">
            <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Configurations</div>
          </div>
          <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
            {sidebarItems.map(({ id, label, icon: Icon }) => (
              <div
                key={id}
                onClick={() => { setActiveOption(id); setPage(1); setSearch(''); setDocTypeSearch(''); setDocTypePage(1); setMarketSearch(''); setMarketPage(1); setBrandingDocsSearch(''); setBrandingDocsPage(1); }}
                style={activeOption === id ? { color: '#53A2FF', borderColor: '#53A2FF', backgroundColor: 'rgba(83,162,255,0.08)' } : {}}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors text-left border-l-2 cursor-pointer ${activeOption === id ? 'font-semibold' : 'text-slate-600 border-transparent hover:bg-slate-50 hover:text-[#53A2FF]'
                  }`}
              >
                <Icon className="size-4 shrink-0" />
                <span className="truncate">{label}</span>
              </div>
            ))}
          </nav>
        </aside>

        {/* ── Main Content ── */}
        <main className="flex-1 overflow-auto p-6">

          {/* ══ BRANDS ══ */}
          {activeOption === 'brands' && (
            <PanelWrapper>
              <PanelBar title="Brands">
                <div className="flex-1 flex justify-center">
                  <div className="relative w-full max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-white/60 pointer-events-none" />
                    <input
                      type="text" value={search}
                      onChange={e => { setSearch(e.target.value); setPage(1); }}
                      placeholder="Search by brand name…"
                      className="w-full bg-white/20 text-white placeholder-white/60 text-xs rounded-full pl-8 pr-4 py-1.5 focus:outline-none focus:ring-1 focus:ring-white/50 border border-white/25"
                    />
                  </div>
                </div>
                <div
                  onClick={openAddBrandModal} title="Add Brand"
                  className="size-8 rounded-full bg-white/20 hover:bg-white/30 border border-white/30 flex items-center justify-center text-white shrink-0 transition-colors cursor-pointer"
                >
                  <Plus className="size-4 text-white" />
                </div>
              </PanelBar>

              {brandsError && (
                <div className="p-4 pb-0">
                  <AlertBanner type="error" message={brandsError} onDismiss={() => setBrandsError(null)} />
                </div>
              )}

              {brandsLoading ? (
                <LoadingState message="Loading brands…" />
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-100 bg-[#53A2FF]/5 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">
                          <th className="px-4 py-3 cursor-pointer select-none hover:text-[#53A2FF] whitespace-nowrap" onClick={() => handleSort('brand_name')}>
                            Brand Name <SortIcon col="brand_name" />
                          </th>
                          <th className="px-4 py-3 whitespace-nowrap">Logo File</th>
                          <th className="px-4 py-3 cursor-pointer select-none hover:text-[#53A2FF] whitespace-nowrap" onClick={() => handleSort('primary_brand_color')}>
                            Primary Color <SortIcon col="primary_brand_color" />
                          </th>
                          <th className="px-4 py-3 cursor-pointer select-none hover:text-[#53A2FF] whitespace-nowrap" onClick={() => handleSort('secondary_brand_color')}>
                            Secondary Color <SortIcon col="secondary_brand_color" />
                          </th>
                          <th className="px-4 py-3 text-center whitespace-nowrap sticky right-0 bg-[#53A2FF]/5 w-20">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginated.length === 0 ? (
                          <tr>
                            <td colSpan={5}>
                              <EmptyState
                                icon={Tag}
                                title={search ? 'No brands match your search' : 'No brands yet'}
                                subtitle={search ? 'Try a different search term' : 'Click + to add your first brand'}
                              />
                            </td>
                          </tr>
                        ) : paginated.map((brand, idx) => (
                          <tr
                            key={brand.brand_id}
                            className={`group border-b border-slate-50 hover:bg-[#53A2FF]/5 transition-colors ${idx % 2 !== 0 ? 'bg-slate-50/40' : ''}`}
                          >
                            <td className="px-4 py-3 font-semibold text-slate-800 whitespace-nowrap">{brand.brand_name || '—'}</td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              {brand.brand_logo
                                ? <span className="inline-flex items-center gap-1.5 text-xs text-slate-500"><Paperclip className="size-3 text-slate-400" />{logoFilename(brand.brand_logo)}</span>
                                : <span className="text-slate-300">—</span>}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              {brand.primary_brand_color
                                ? <span className="inline-flex items-center gap-2 text-xs text-slate-600"><span className="size-3.5 rounded border border-slate-200 shrink-0" style={{ backgroundColor: brand.primary_brand_color }} />{brand.primary_brand_color}</span>
                                : <span className="text-slate-300">—</span>}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              {brand.secondary_brand_color
                                ? <span className="inline-flex items-center gap-2 text-xs text-slate-600"><span className="size-3.5 rounded border border-slate-200 shrink-0" style={{ backgroundColor: brand.secondary_brand_color }} />{brand.secondary_brand_color}</span>
                                : <span className="text-slate-300">—</span>}
                            </td>
                            <td className="px-4 py-3 text-center whitespace-nowrap sticky right-0 bg-white group-hover:bg-[#53A2FF]/5 transition-colors w-20">
                              <div
                                onClick={() => openEditBrandModal(brand)} title="Edit brand"
                                style={{ color: '#53A2FF' }}
                                className="inline-flex items-center justify-center size-7 rounded-md hover:bg-[#53A2FF]/10 transition-colors border border-transparent hover:border-[#53A2FF]/30 cursor-pointer"
                              >
                                <Pencil className="size-3.5" />
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination */}
                  <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-slate-50/50">
                    <p className="text-xs text-slate-400">
                      {filtered.length === 0 ? 'No results' : `${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, filtered.length)} of ${filtered.length} brands`}
                    </p>
                    <div className="flex items-center gap-1">
                      <div onClick={() => { if (page > 1) setPage(p => Math.max(1, p - 1)); }} style={{ color: '#53A2FF' }} className={`size-7 flex items-center justify-center rounded border border-slate-200 hover:bg-[#53A2FF]/10 transition-colors ${page === 1 ? 'opacity-40 pointer-events-none cursor-not-allowed' : 'cursor-pointer'}`}>
                        <ChevronLeft className="size-3.5" />
                      </div>
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                        <div key={p} onClick={() => setPage(p)} style={p === page ? { backgroundColor: '#53A2FF', borderColor: '#53A2FF' } : { color: '#64748b' }} className={`size-7 flex items-center justify-center rounded border text-xs font-medium transition-colors cursor-pointer ${p === page ? 'text-white' : 'border-slate-200 hover:bg-[#53A2FF]/10'}`}>{p}</div>
                      ))}
                      <div onClick={() => { if (page < totalPages) setPage(p => Math.min(totalPages, p + 1)); }} style={{ color: '#53A2FF' }} className={`size-7 flex items-center justify-center rounded border border-slate-200 hover:bg-[#53A2FF]/10 transition-colors ${page === totalPages ? 'opacity-40 pointer-events-none cursor-not-allowed' : 'cursor-pointer'}`}>
                        <ChevronRight className="size-3.5" />
                      </div>
                    </div>
                  </div>
                </>
              )}
            </PanelWrapper>
          )}

          {/* ══ LOCAL DOCUMENTS (non-Veeva domains) ══ */}
          {activeOption === 'local-documents' && (
            <PanelWrapper>
              <PanelBar title="Local Documents" />
              <div className="p-8">
                <p className="text-sm text-slate-500 mb-6 leading-relaxed">
                  Upload documents directly from your machine. They are saved to local storage and indexed in the Document Library — no external Vault required.
                </p>

                {localResult && (
                  <AlertBanner
                    type={localResult.success ? 'success' : 'error'}
                    message={localResult.success ? (localResult.message || 'Upload successful') : (localResult.error || 'Upload failed')}
                    onDismiss={() => setLocalResult(null)}
                  />
                )}

                <div className="max-w-lg">
                  {/* File picker */}
                  <div className="mb-4">
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                      Document <span className="text-red-400">*</span>
                    </label>
                    <div
                      onClick={() => localFileRef.current?.click()}
                      className={`flex items-center gap-3 border-2 border-dashed rounded-lg px-4 py-4 cursor-pointer transition-colors ${localFileTouched && !localFile
                        ? 'border-red-300 bg-red-50'
                        : localFile
                          ? 'border-[#53A2FF]/40 bg-[#53A2FF]/5'
                          : 'border-slate-200 hover:border-[#53A2FF]/50 hover:bg-slate-50'
                        }`}
                    >
                      <Upload size={18} className={localFile ? 'text-[#53A2FF]' : 'text-slate-400'} />
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm truncate font-medium ${localFile ? 'text-[#53A2FF]' : 'text-slate-400'}`}>
                          {localFile ? localFile.name : 'Click to choose a file…'}
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5">PDF, Word, Text</p>
                      </div>
                      {localFile && (
                        <div
                          onClick={e => { e.stopPropagation(); setLocalFile(null); setLocalDocName(''); if (localFileRef.current) localFileRef.current.value = ''; }}
                          className="p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-400 transition-colors cursor-pointer"
                        >
                          <X size={14} />
                        </div>
                      )}
                    </div>
                    {localFileTouched && !localFile && (
                      <p className="text-xs text-red-500 mt-1 flex items-center gap-1"><AlertCircle size={11} /> Please select a file to upload.</p>
                    )}
                    <input ref={localFileRef} type="file" className="hidden" accept=".pdf,.doc,.docx,.txt"
                      onChange={e => {
                        const f = e.target.files?.[0] ?? null;
                        setLocalFile(f); setLocalFileTouched(true); setLocalResult(null);
                        if (f && !localDocName) setLocalDocName(f.name.replace(/\.[^.]+$/, ''));
                      }}
                    />
                  </div>

                  {/* Document name */}
                  <div className="mb-4">
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                      Document Name <span className="text-slate-400 font-normal">(optional)</span>
                    </label>
                    <input
                      className={inputCls} placeholder="Defaults to filename"
                      value={localDocName} onChange={e => setLocalDocName(e.target.value)}
                    />
                  </div>

                  {/* Metadata dropdowns */}
                  <div className="grid grid-cols-3 gap-3 mb-6">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1.5">Brand</label>
                      <select className={inputCls} value={localBrandId} onChange={e => setLocalBrandId(e.target.value)}>
                        <option value="">— Select —</option>
                        {brands.map(b => <option key={b.brand_id} value={b.brand_id}>{b.brand_name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1.5">Asset Type</label>
                      <select className={inputCls} value={localDocTypeId} onChange={e => setLocalDocTypeId(e.target.value)}>
                        <option value="">— Select —</option>
                        {docTypes.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1.5">Market</label>
                      <select className={inputCls} value={localMarketId} onChange={e => setLocalMarketId(e.target.value)}>
                        <option value="">— Select —</option>
                        {markets.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                      </select>
                    </div>
                  </div>

                  <div
                    onClick={handleLocalUpload}
                    className={`inline-flex items-center gap-2 px-6 py-2.5 rounded-lg text-white text-sm font-semibold transition-opacity shadow-sm ${localUploading ? 'bg-slate-300 pointer-events-none cursor-not-allowed' : 'bg-[#53A2FF] hover:bg-[#3a8ee8] cursor-pointer'}`}
                  >
                    {localUploading
                      ? <><Loader2 size={14} className="animate-spin" /> Uploading…</>
                      : <><CloudUpload size={14} /> Upload Document</>}
                  </div>
                </div>

                {/* Uploaded documents list */}
                <div className="mt-10">
                  <h4 className="text-sm font-semibold text-slate-700 mb-3">Uploaded Documents</h4>
                  {localDocsLoading ? (
                    <LoadingState message="Loading uploaded documents…" />
                  ) : localDocs.length === 0 ? (
                    <EmptyState icon={FolderOpen} title="No documents uploaded yet" subtitle="Use the form above to add your first document." />
                  ) : (
                    <div className="border border-slate-100 rounded-lg overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-slate-50 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">
                          <tr>
                            <th className="px-4 py-2">Name</th>
                            <th className="px-4 py-2">Filename</th>
                            <th className="px-4 py-2">Brand</th>
                            <th className="px-4 py-2">Asset Type</th>
                            <th className="px-4 py-2">Market</th>
                            <th className="px-4 py-2">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {localDocs.map(d => (
                            <tr key={d.id} className="border-t border-slate-100">
                              <td className="px-4 py-2">{d.name || d.filename}</td>
                              <td className="px-4 py-2 text-slate-500">{d.filename}</td>
                              <td className="px-4 py-2 text-slate-500">{d.brand_name || '—'}</td>
                              <td className="px-4 py-2 text-slate-500">{d.document_type_name || '—'}</td>
                              <td className="px-4 py-2 text-slate-500">{d.market_name || '—'}</td>
                              <td className="px-4 py-2 text-slate-500">{d.status || 'Approved'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </PanelWrapper>
          )}

          {/* ══ UPLOAD TO VEEVA ══ */}
          {activeOption === 'upload-to-veeva' && (
            <PanelWrapper>
              <PanelBar title="Upload to Veeva" />
              <div className="p-8 max-w-lg mx-auto">
                <p className="text-sm text-slate-500 mb-6 leading-relaxed">
                  Choose a document to upload directly to Veeva Vault. The document will be submitted and automatically set to <strong className="text-slate-700">Approved</strong> status.
                </p>

                {veevaResult && (
                  <AlertBanner
                    type={veevaResult.success ? 'success' : 'error'}
                    message={veevaResult.success ? (veevaResult.message || 'Upload successful') : (veevaResult.error || 'Upload failed')}
                    onDismiss={() => setVeevaResult(null)}
                  />
                )}

                {/* File picker */}
                <div className="mb-4">
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                    Document <span className="text-red-400">*</span>
                  </label>
                  <div
                    onClick={() => veevaFileRef.current?.click()}
                    className={`flex items-center gap-3 border-2 border-dashed rounded-lg px-4 py-4 cursor-pointer transition-colors ${veevaFileTouched && !veevaFile
                      ? 'border-red-300 bg-red-50'
                      : veevaFile
                        ? 'border-[#53A2FF]/40 bg-[#53A2FF]/5'
                        : 'border-slate-200 hover:border-[#53A2FF]/50 hover:bg-slate-50'
                      }`}
                  >
                    <Upload size={18} className={veevaFile ? 'text-[#53A2FF]' : 'text-slate-400'} />
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm truncate font-medium ${veevaFile ? 'text-[#53A2FF]' : 'text-slate-400'}`}>
                        {veevaFile ? veevaFile.name : 'Click to choose a file…'}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">PDF, Word, Text</p>
                    </div>
                    {veevaFile && (
                      <div
                        onClick={e => { e.stopPropagation(); setVeevaFile(null); setVeevaDocName(''); if (veevaFileRef.current) veevaFileRef.current.value = ''; }}
                        className="p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-400 transition-colors cursor-pointer"
                      >
                        <X size={14} />
                      </div>
                    )}
                  </div>
                  {veevaFileTouched && !veevaFile && (
                    <p className="text-xs text-red-500 mt-1 flex items-center gap-1"><AlertCircle size={11} /> Please select a file to upload.</p>
                  )}
                  <input ref={veevaFileRef} type="file" className="hidden" accept=".pdf,.doc,.docx,.txt"
                    onChange={e => {
                      const f = e.target.files?.[0] ?? null;
                      setVeevaFile(f); setVeevaFileTouched(true); setVeevaResult(null);
                      if (f && !veevaDocName) setVeevaDocName(f.name.replace(/\.[^.]+$/, ''));
                    }}
                  />
                </div>

                {/* Document name */}
                <div className="mb-4">
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                    Document Name <span className="text-slate-400 font-normal">(optional)</span>
                  </label>
                  <input
                    className={inputCls} placeholder="Defaults to filename"
                    value={veevaDocName} onChange={e => setVeevaDocName(e.target.value)}
                  />
                </div>

                {/* Metadata dropdowns */}
                <div className="grid grid-cols-3 gap-3 mb-6">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">Brand</label>
                    <select className={inputCls} value={veevaBrandId} onChange={e => setVeevaBrandId(e.target.value)}>
                      <option value="">— Select —</option>
                      {brands.map(b => <option key={b.brand_id} value={b.brand_id}>{b.brand_name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">Asset Type</label>
                    <select className={inputCls} value={veevaDocTypeId} onChange={e => setVeevaDocTypeId(e.target.value)}>
                      <option value="">— Select —</option>
                      {docTypes.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">Market</label>
                    <select className={inputCls} value={veevaMarketId} onChange={e => setVeevaMarketId(e.target.value)}>
                      <option value="">— Select —</option>
                      {markets.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </select>
                  </div>
                </div>

                <div
                  onClick={async () => {
                    if (veevaUploading) return;
                    setVeevaFileTouched(true);
                    if (!veevaFile) return;
                    setVeevaUploading(true); setVeevaResult(null);
                    try {
                      const result = await uploadToVeeva(veevaFile, domain, veevaDocName, veevaBrandId || undefined);
                      setVeevaResult(result);
                      if (result.success) {
                        try {
                          await createBrandingDoc({
                            document_unique_id: String(result.doc_id || ''),
                            version_id: result.version_id || null,
                            filename: result.filename || veevaFile.name,
                            name: veevaDocName || veevaFile.name.replace(/\.[^.]+$/, ''),
                            status: result.approved ? 'Approved' : 'Pending',
                            brand_id: veevaBrandId || null,
                            document_type_id: veevaDocTypeId ? Number(veevaDocTypeId) : null,
                            market_id: veevaMarketId ? Number(veevaMarketId) : null,
                            domain: domain,
                          });
                        } catch (_) { /* DB save failed silently — Veeva upload succeeded */ }
                        setVeevaFile(null); setVeevaDocName(''); setVeevaFileTouched(false);
                        setVeevaBrandId(''); setVeevaDocTypeId(''); setVeevaMarketId('');
                        if (veevaFileRef.current) veevaFileRef.current.value = '';
                      }
                    } catch (err: unknown) {
                      setVeevaResult({ success: false, error: err instanceof Error ? err.message : 'Upload failed' });
                    } finally {
                      setVeevaUploading(false);
                    }
                  }}
                  style={{ backgroundColor: veevaUploading ? undefined : '#53A2FF' }}
                  className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-white text-sm font-semibold transition-opacity shadow-sm ${veevaUploading ? 'bg-slate-300 pointer-events-none cursor-not-allowed' : 'hover:opacity-90 cursor-pointer'}`}
                >
                  {veevaUploading
                    ? <><Loader2 size={15} className="animate-spin" /> Uploading…</>
                    : <><CloudUpload size={15} /> Upload to Veeva</>}
                </div>
              </div>
            </PanelWrapper>
          )}

          {/* ══ BRANDING DOCUMENTS ══ */}
          {activeOption === 'branding-documents' && (
            <PanelWrapper>
              <PanelBar title="Branding Documents">
                <div className="flex-1 flex justify-center">
                  <div className="relative w-full max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-white/60 pointer-events-none" />
                    <input
                      type="text" value={brandingDocsSearch}
                      onChange={e => { setBrandingDocsSearch(e.target.value); setBrandingDocsPage(1); }}
                      placeholder="Search by filename or brand…"
                      className="w-full bg-white/20 text-white placeholder-white/60 text-xs rounded-full pl-8 pr-4 py-1.5 focus:outline-none focus:ring-1 focus:ring-white/50 border border-white/25"
                    />
                  </div>
                </div>
                <div
                  onClick={() => { if (!brandingDocsFetching) handleFetchFromVeeva(); }}
                  className={`flex items-center gap-1.5 bg-white/20 hover:bg-white/30 text-white text-xs font-semibold px-4 py-1.5 rounded-full transition-colors whitespace-nowrap ${brandingDocsFetching ? 'opacity-60 pointer-events-none cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  {brandingDocsFetching
                    ? <><Loader2 size={13} className="animate-spin" /> Syncing…</>
                    : <><RefreshCw size={13} /> Sync from Veeva</>}
                </div>
              </PanelBar>

              {(brandingFetchMsg || brandingDocsError) && (
                <div className="p-4 pb-0">
                  {brandingFetchMsg && <AlertBanner type="success" message={brandingFetchMsg} onDismiss={() => setBrandingFetchMsg(null)} />}
                  {brandingDocsError && <AlertBanner type="error" message={brandingDocsError} onDismiss={() => setBrandingDocsError(null)} />}
                </div>
              )}

              {brandingDocsLoading ? (
                <LoadingState message="Loading documents…" />
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-100 bg-[#53A2FF]/5 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">
                          <th className="px-4 py-3">Filename</th>
                          <th className="px-4 py-3">Status</th>
                          <th className="px-4 py-3">Brand</th>
                          <th className="px-4 py-3">Asset Type</th>
                          <th className="px-4 py-3">Market</th>
                          <th className="px-4 py-3 text-center sticky right-0 bg-[#53A2FF]/5 w-20">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedBrandingDocs.length === 0 ? (
                          <tr>
                            <td colSpan={6}>
                              <EmptyState
                                icon={FileText}
                                title={brandingDocsSearch ? 'No documents match your search' : 'No documents synced yet'}
                                subtitle={brandingDocsSearch ? 'Try a different search term' : 'Click "Sync from Veeva" to pull your approved documents'}
                              />
                            </td>
                          </tr>
                        ) : paginatedBrandingDocs.map((doc, idx) => (
                          <tr key={doc.id} className={`group border-b border-slate-50 hover:bg-[#53A2FF]/5 transition-colors ${idx % 2 !== 0 ? 'bg-slate-50/40' : ''}`}>
                            <td className="px-4 py-3 text-slate-500 text-xs max-w-44 truncate" title={doc.filename || ''}>
                              {doc.filename ? <span className="inline-flex items-center gap-1"><Paperclip size={11} />{doc.filename}</span> : '—'}
                            </td>
                            <td className="px-4 py-3">
                              <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${doc.status?.toLowerCase() === 'approved' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                                {doc.status || '—'}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm text-slate-600">{doc.brand_name || <span className="text-slate-300 text-xs">Not set</span>}</td>
                            <td className="px-4 py-3 text-sm text-slate-600">{doc.document_type_name || <span className="text-slate-300 text-xs">Not set</span>}</td>
                            <td className="px-4 py-3 text-sm text-slate-600">{doc.market_name || <span className="text-slate-300 text-xs">Not set</span>}</td>
                            <td className="px-4 py-3 text-center whitespace-nowrap sticky right-0 bg-white group-hover:bg-[#53A2FF]/5 transition-colors w-20">
                              <div onClick={() => openDocEdit(doc)} title="Edit metadata" style={{ color: '#53A2FF' }} className="inline-flex items-center justify-center size-7 rounded-md hover:bg-[#53A2FF]/10 border border-[#53A2FF]/30 transition-colors cursor-pointer">
                                <Pencil size={13} />
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination */}
                  <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-slate-50/50">
                    <div className="text-xs text-slate-400">
                      {filteredBrandingDocs.length === 0 ? 'No results' : `${(brandingDocsPage - 1) * PAGE_SIZE + 1}–${Math.min(brandingDocsPage * PAGE_SIZE, filteredBrandingDocs.length)} of ${filteredBrandingDocs.length} documents`}
                    </div>
                    <div className="flex items-center gap-1">
                      <div onClick={() => { if (brandingDocsPage > 1) setBrandingDocsPage(p => Math.max(1, p - 1)); }} style={{ color: '#53A2FF' }} className={`size-7 flex items-center justify-center rounded border border-slate-200 hover:bg-[#53A2FF]/10 transition-colors ${brandingDocsPage === 1 ? 'opacity-40 pointer-events-none cursor-not-allowed' : 'cursor-pointer'}`}>
                        <ChevronLeft className="size-3.5" />
                      </div>
                      {Array.from({ length: bdTotalPages }, (_, i) => i + 1).map(p => (
                        <div key={p} onClick={() => setBrandingDocsPage(p)} style={p === brandingDocsPage ? { backgroundColor: '#53A2FF', borderColor: '#53A2FF' } : { color: '#64748b' }} className={`size-7 flex items-center justify-center rounded border text-xs font-medium transition-colors cursor-pointer ${p === brandingDocsPage ? 'text-white' : 'border-slate-200 hover:bg-[#53A2FF]/10'}`}>{p}</div>
                      ))}
                      <div onClick={() => { if (brandingDocsPage < bdTotalPages) setBrandingDocsPage(p => Math.min(bdTotalPages, p + 1)); }} style={{ color: '#53A2FF' }} className={`size-7 flex items-center justify-center rounded border border-slate-200 hover:bg-[#53A2FF]/10 transition-colors ${brandingDocsPage === bdTotalPages ? 'opacity-40 pointer-events-none cursor-not-allowed' : 'cursor-pointer'}`}>
                        <ChevronRight className="size-3.5" />
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* Edit metadata modal */}
              {editingDoc && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                  <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
                    <div className="flex items-center justify-between px-5 py-3.5" style={{ backgroundColor: '#53A2FF' }}>
                      <div>
                        <div className="text-base font-semibold text-white leading-tight">Edit Document Metadata</div>
                        <div className="text-white/70 text-xs mt-0.5 truncate max-w-72">{editingDoc.name}</div>
                      </div>
                      <div onClick={() => setEditingDoc(null)} className="text-white/80 hover:text-white p-1 rounded hover:bg-white/20 transition-colors cursor-pointer"><X size={18} /></div>
                    </div>
                    <div className="p-5 space-y-4">
                      {docEditError && <AlertBanner type="error" message={docEditError} onDismiss={() => setDocEditError(null)} />}
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1.5">Brand</label>
                        <select className={inputCls} value={docEditForm.brand_id} onChange={e => setDocEditForm(f => ({ ...f, brand_id: e.target.value }))}>
                          <option value="">— Select Brand —</option>
                          {brands.map(b => <option key={b.brand_id} value={b.brand_id}>{b.brand_name || b.brand_id}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1.5">Asset Type</label>
                        <select className={inputCls} value={docEditForm.document_type_id} onChange={e => setDocEditForm(f => ({ ...f, document_type_id: e.target.value }))}>
                          <option value="">— Select Asset Type —</option>
                          {docTypes.map(dt => <option key={dt.id} value={String(dt.id)}>{dt.name}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1.5">Market</label>
                        <select className={inputCls} value={docEditForm.market_id} onChange={e => setDocEditForm(f => ({ ...f, market_id: e.target.value }))}>
                          <option value="">— Select Market —</option>
                          {markets.map(m => <option key={m.id} value={String(m.id)}>{m.name}</option>)}
                        </select>
                      </div>
                    </div>
                    <div className="flex justify-end gap-2 px-5 py-4 border-t border-slate-100">
                      <div onClick={() => setEditingDoc(null)} className="px-4 py-2 rounded-lg text-sm text-slate-600 border border-slate-200 hover:bg-slate-50 transition-colors cursor-pointer">Cancel</div>
                      <div onClick={() => { if (!docEditSaving) saveDocEdit(); }} style={{ backgroundColor: '#53A2FF' }} className={`flex items-center gap-2 px-5 py-2 rounded-lg text-white text-sm font-semibold hover:opacity-90 transition-opacity ${docEditSaving ? 'opacity-60 pointer-events-none cursor-not-allowed' : 'cursor-pointer'}`}>
                        {docEditSaving ? <><Loader2 size={14} className="animate-spin" /> Saving…</> : 'Save Changes'}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </PanelWrapper>
          )}

          {/* ══ DOCUMENT TYPES ══ */}
          {activeOption === 'document-types' && (
            <PanelWrapper>
              <PanelBar title="Asset Types">
                <div className="flex-1 flex justify-center">
                  <div className="relative w-full max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-white/60 pointer-events-none" />
                    <input
                      type="text" value={docTypeSearch}
                      onChange={e => { setDocTypeSearch(e.target.value); setDocTypePage(1); }}
                      placeholder="Search by name…"
                      className="w-full bg-white/20 text-white placeholder-white/60 text-xs rounded-full pl-8 pr-4 py-1.5 focus:outline-none focus:ring-1 focus:ring-white/50 border border-white/25"
                    />
                  </div>
                </div>
                <div
                  onClick={() => openDocTypeModal()} title="Add Asset Type"
                  className="size-8 rounded-full bg-white/20 hover:bg-white/30 border border-white/30 flex items-center justify-center text-white shrink-0 transition-colors cursor-pointer"
                >
                  <Plus className="size-4" />
                </div>
              </PanelBar>

              {docTypesError && (
                <div className="p-4 pb-0">
                  <AlertBanner type="error" message={docTypesError} onDismiss={() => setDocTypesError(null)} />
                </div>
              )}

              {docTypesLoading ? (
                <LoadingState message="Loading asset types…" />
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="text-sm">
                      <thead>
                        <tr className="border-b border-slate-100 bg-[#53A2FF]/5 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">
                          <th className="px-4 py-3 min-w-50">Name</th>
                          <th className="px-4 py-3 text-center w-20">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedDocTypes.length === 0 ? (
                          <tr><td colSpan={2}><EmptyState icon={Layers} title={docTypeSearch ? 'No asset types match your search' : 'No asset types yet'} subtitle={docTypeSearch ? 'Try a different search term' : 'Click + to add your first asset type'} /></td></tr>
                        ) : paginatedDocTypes.map((dt, idx) => (
                          <tr key={dt.id} className={`group border-b border-slate-50 hover:bg-[#53A2FF]/5 transition-colors ${idx % 2 !== 0 ? 'bg-slate-50/40' : ''}`}>
                            <td className="px-4 py-3 font-semibold text-slate-800 whitespace-nowrap">{dt.name}</td>
                            <td className="px-4 py-3 text-center w-20">
                              <div onClick={() => openDocTypeModal(dt)} title="Edit asset type" style={{ color: '#53A2FF' }} className="inline-flex items-center justify-center size-7 rounded-md hover:bg-[#53A2FF]/10 transition-colors border border-transparent hover:border-[#53A2FF]/30 cursor-pointer">
                                <Pencil className="size-3.5" />
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination */}
                  <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-slate-50/50">
                    <div className="text-xs text-slate-400">
                      {filteredDocTypes.length === 0 ? 'No results' : `${(docTypePage - 1) * PAGE_SIZE + 1}–${Math.min(docTypePage * PAGE_SIZE, filteredDocTypes.length)} of ${filteredDocTypes.length} asset types`}
                    </div>
                    <div className="flex items-center gap-1">
                      <div onClick={() => { if (docTypePage > 1) setDocTypePage(p => Math.max(1, p - 1)); }} style={{ color: '#53A2FF' }} className={`size-7 flex items-center justify-center rounded border border-slate-200 hover:bg-[#53A2FF]/10 transition-colors ${docTypePage === 1 ? 'opacity-40 pointer-events-none cursor-not-allowed' : 'cursor-pointer'}`}>
                        <ChevronLeft className="size-3.5" />
                      </div>
                      {Array.from({ length: dtTotalPages }, (_, i) => i + 1).map(p => (
                        <div key={p} onClick={() => setDocTypePage(p)} style={p === docTypePage ? { backgroundColor: '#53A2FF', borderColor: '#53A2FF' } : { color: '#64748b' }} className={`size-7 flex items-center justify-center rounded border text-xs font-medium transition-colors cursor-pointer ${p === docTypePage ? 'text-white' : 'border-slate-200 hover:bg-[#53A2FF]/10'}`}>{p}</div>
                      ))}
                      <div onClick={() => { if (docTypePage < dtTotalPages) setDocTypePage(p => Math.min(dtTotalPages, p + 1)); }} style={{ color: '#53A2FF' }} className={`size-7 flex items-center justify-center rounded border border-slate-200 hover:bg-[#53A2FF]/10 transition-colors ${docTypePage === dtTotalPages ? 'opacity-40 pointer-events-none cursor-not-allowed' : 'cursor-pointer'}`}>
                        <ChevronRight className="size-3.5" />
                      </div>
                    </div>
                  </div>
                </>
              )}
            </PanelWrapper>
          )}

          {/* ══ MARKETS ══ */}
          {activeOption === 'markets' && (
            <PanelWrapper>
              <PanelBar title="Markets">
                <div className="flex-1 flex justify-center">
                  <div className="relative w-full max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-white/60 pointer-events-none" />
                    <input
                      type="text" value={marketSearch}
                      onChange={e => { setMarketSearch(e.target.value); setMarketPage(1); }}
                      placeholder="Search by name…"
                      className="w-full bg-white/20 text-white placeholder-white/60 text-xs rounded-full pl-8 pr-4 py-1.5 focus:outline-none focus:ring-1 focus:ring-white/50 border border-white/25"
                    />
                  </div>
                </div>
                <div
                  onClick={() => openMarketModal()} title="Add Market"
                  className="size-8 rounded-full bg-white/20 hover:bg-white/30 border border-white/30 flex items-center justify-center text-white shrink-0 transition-colors cursor-pointer"
                >
                  <Plus className="size-4" />
                </div>
              </PanelBar>

              {marketsError && (
                <div className="p-4 pb-0">
                  <AlertBanner type="error" message={marketsError} onDismiss={() => setMarketsError(null)} />
                </div>
              )}

              {marketsLoading ? (
                <LoadingState message="Loading markets…" />
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="text-sm">
                      <thead>
                        <tr className="border-b border-slate-100 bg-[#53A2FF]/5 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">
                          <th className="px-4 py-3 min-w-50">Name</th>
                          <th className="px-4 py-3 text-center w-20">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedMarkets.length === 0 ? (
                          <tr><td colSpan={2}><EmptyState icon={Globe} title={marketSearch ? 'No markets match your search' : 'No markets yet'} subtitle={marketSearch ? 'Try a different search term' : 'Click + to add your first market'} /></td></tr>
                        ) : paginatedMarkets.map((m, idx) => (
                          <tr key={m.id} className={`group border-b border-slate-50 hover:bg-[#53A2FF]/5 transition-colors ${idx % 2 !== 0 ? 'bg-slate-50/40' : ''}`}>
                            <td className="px-4 py-3 font-semibold text-slate-800 whitespace-nowrap">{m.name}</td>
                            <td className="px-4 py-3 text-center w-20">
                              <div onClick={() => openMarketModal(m)} title="Edit market" style={{ color: '#53A2FF' }} className="inline-flex items-center justify-center size-7 rounded-md hover:bg-[#53A2FF]/10 transition-colors border border-transparent hover:border-[#53A2FF]/30 cursor-pointer">
                                <Pencil className="size-3.5" />
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination */}
                  <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-slate-50/50">
                    <div className="text-xs text-slate-400">
                      {filteredMarkets.length === 0 ? 'No results' : `${(marketPage - 1) * PAGE_SIZE + 1}–${Math.min(marketPage * PAGE_SIZE, filteredMarkets.length)} of ${filteredMarkets.length} markets`}
                    </div>
                    <div className="flex items-center gap-1">
                      <div onClick={() => { if (marketPage > 1) setMarketPage(p => Math.max(1, p - 1)); }} style={{ color: '#53A2FF' }} className={`size-7 flex items-center justify-center rounded border border-slate-200 hover:bg-[#53A2FF]/10 transition-colors ${marketPage === 1 ? 'opacity-40 pointer-events-none cursor-not-allowed' : 'cursor-pointer'}`}>
                        <ChevronLeft className="size-3.5" />
                      </div>
                      {Array.from({ length: mktTotalPages }, (_, i) => i + 1).map(p => (
                        <div key={p} onClick={() => setMarketPage(p)} style={p === marketPage ? { backgroundColor: '#53A2FF', borderColor: '#53A2FF' } : { color: '#64748b' }} className={`size-7 flex items-center justify-center rounded border text-xs font-medium transition-colors cursor-pointer ${p === marketPage ? 'text-white' : 'border-slate-200 hover:bg-[#53A2FF]/10'}`}>{p}</div>
                      ))}
                      <div onClick={() => { if (marketPage < mktTotalPages) setMarketPage(p => Math.min(mktTotalPages, p + 1)); }} style={{ color: '#53A2FF' }} className={`size-7 flex items-center justify-center rounded border border-slate-200 hover:bg-[#53A2FF]/10 transition-colors ${marketPage === mktTotalPages ? 'opacity-40 pointer-events-none cursor-not-allowed' : 'cursor-pointer'}`}>
                        <ChevronRight className="size-3.5" />
                      </div>
                    </div>
                  </div>
                </>
              )}
            </PanelWrapper>
          )}
          {/* ══ TEMPLATES ══ */}
          {activeOption === 'templates' && (
            <PanelWrapper>
              <PanelBar title="Templates">
                <div className="flex-1 flex justify-center">
                  <div className="relative w-full max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-white/60 pointer-events-none" />
                    <input
                      type="text" value={templateSearch}
                      onChange={e => { setTemplateSearch(e.target.value); setTemplatePage(1); }}
                      placeholder="Search by name…"
                      className="w-full bg-white/20 text-white placeholder-white/60 text-xs rounded-full pl-8 pr-4 py-1.5 focus:outline-none focus:ring-1 focus:ring-white/50 border border-white/25"
                    />
                  </div>
                </div>
                <div
                  onClick={() => openTemplateModal()} title="Add Template"
                  className="size-8 rounded-full bg-white/20 hover:bg-white/30 border border-white/30 flex items-center justify-center text-white shrink-0 transition-colors cursor-pointer"
                >
                  <Plus className="size-4" />
                </div>
              </PanelBar>

              {templatesError && (
                <div className="p-4 pb-0">
                  <AlertBanner type="error" message={templatesError} onDismiss={() => setTemplatesError(null)} />
                </div>
              )}

              {templatesLoading ? (
                <LoadingState message="Loading templates…" />
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-100 bg-[#53A2FF]/5 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">
                          <th className="px-4 py-3 min-w-50">Name</th>
                          <th className="px-4 py-3 min-w-50">Brand</th>
                          <th className="px-4 py-3 min-w-50">References</th>
                          <th className="px-4 py-3 text-center w-20">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {templates.filter(t => t.name.toLowerCase().includes(templateSearch.toLowerCase())).length === 0 ? (
                          <tr><td colSpan={4}><EmptyState icon={LayoutTemplate} title={templateSearch ? 'No templates match your search' : 'No templates yet'} subtitle={templateSearch ? 'Try a different search term' : 'Click + to add your first template'} /></td></tr>
                        ) : templates.filter(t => t.name.toLowerCase().includes(templateSearch.toLowerCase())).map((t, idx) => (
                          <tr key={t.id} className={`group border-b border-slate-50 hover:bg-[#53A2FF]/5 transition-colors ${idx % 2 !== 0 ? 'bg-slate-50/40' : ''}`}>
                            <td className="px-4 py-3 font-semibold text-slate-800 whitespace-nowrap">{t.name}</td>
                            <td className="px-4 py-3 whitespace-nowrap">{brands.find(b => b.brand_id === t.brand_id)?.brand_name || '—'}</td>
                            <td className="px-4 py-3 whitespace-nowrap">{t.references.length} images</td>
                            <td className="px-4 py-3 text-center w-20">
                              <div onClick={() => handleDeleteTemplate(t.id)} title="Delete template" className="inline-flex items-center justify-center size-7 rounded-md text-red-500 hover:bg-red-50 transition-colors border border-transparent hover:border-red-200 cursor-pointer">
                                <X className="size-3.5" />
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </PanelWrapper>
          )}
        </main>
      </div>

      {/* ══ Asset Type Modal ══ */}
      {showDocTypeModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5" style={{ backgroundColor: '#53A2FF' }}>
              <div className="text-base font-semibold text-white leading-tight">{editingDocType ? 'Edit Asset Type' : 'Add Asset Type'}</div>
              <div onClick={() => setShowDocTypeModal(false)} className="text-white/80 hover:text-white p-1 rounded hover:bg-white/20 transition-colors cursor-pointer"><X size={18} /></div>
            </div>
            <div className="p-5 space-y-3">
              {docTypeModalError && <AlertBanner type="error" message={docTypeModalError} onDismiss={() => setDocTypeModalError(null)} />}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Name <span className="text-red-400">*</span></label>
                <input
                  className={docTypeFormTouched && !docTypeForm.trim() ? inputErrCls : inputCls}
                  value={docTypeForm}
                  onChange={e => { setDocTypeForm(e.target.value); setDocTypeFormTouched(true); if (e.target.value.trim()) setDocTypeModalError(null); }}
                  placeholder="e.g. Press Release"
                  autoFocus
                />
                {docTypeFormTouched && !docTypeForm.trim() && (
                  <p className="text-xs text-red-500 mt-1 flex items-center gap-1"><AlertCircle size={11} /> Name is required.</p>
                )}
              </div>
            </div>
            <div className="flex justify-end gap-2 px-5 py-4 border-t border-slate-100">
              <div onClick={() => setShowDocTypeModal(false)} className="px-4 py-2 rounded-lg text-sm text-slate-600 border border-slate-200 hover:bg-slate-50 transition-colors cursor-pointer">Cancel</div>
              <div
                onClick={() => { if (!docTypeSaving) saveDocType(); }}
                style={{ backgroundColor: '#53A2FF' }}
                className={`flex items-center gap-2 px-5 py-2 rounded-lg text-white text-sm font-semibold hover:opacity-90 transition-opacity whitespace-nowrap ${docTypeSaving ? 'opacity-60 pointer-events-none cursor-not-allowed' : 'cursor-pointer'}`}
              >
                {docTypeSaving ? <><Loader2 size={14} className="animate-spin" /> Saving…</> : (editingDocType ? 'Save Changes' : 'Add Asset Type')}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══ Market Modal ══ */}
      {showMarketModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5" style={{ backgroundColor: '#53A2FF' }}>
              <div className="text-base font-semibold text-white leading-tight">{editingMarket ? 'Edit Market' : 'Add Market'}</div>
              <div onClick={() => setShowMarketModal(false)} className="text-white/80 hover:text-white p-1 rounded hover:bg-white/20 transition-colors cursor-pointer"><X size={18} /></div>
            </div>
            <div className="p-5 space-y-3">
              {marketModalError && <AlertBanner type="error" message={marketModalError} onDismiss={() => setMarketModalError(null)} />}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Name <span className="text-red-400">*</span></label>
                <input
                  className={marketFormTouched && !marketForm.trim() ? inputErrCls : inputCls}
                  value={marketForm}
                  onChange={e => { setMarketForm(e.target.value); setMarketFormTouched(true); if (e.target.value.trim()) setMarketModalError(null); }}
                  placeholder="e.g. United States"
                  autoFocus
                />
                {marketFormTouched && !marketForm.trim() && (
                  <p className="text-xs text-red-500 mt-1 flex items-center gap-1"><AlertCircle size={11} /> Name is required.</p>
                )}
              </div>
            </div>
            <div className="flex justify-end gap-2 px-5 py-4 border-t border-slate-100">
              <div onClick={() => setShowMarketModal(false)} className="px-4 py-2 rounded-lg text-sm text-slate-600 border border-slate-200 hover:bg-slate-50 transition-colors cursor-pointer">Cancel</div>
              <div
                onClick={() => { if (!marketSaving) saveMarket(); }}
                style={{ backgroundColor: '#53A2FF' }}
                className={`flex items-center gap-2 px-5 py-2 rounded-lg text-white text-sm font-semibold hover:opacity-90 transition-opacity whitespace-nowrap ${marketSaving ? 'opacity-60 pointer-events-none cursor-not-allowed' : 'cursor-pointer'}`}
              >
                {marketSaving ? <><Loader2 size={14} className="animate-spin" /> Saving…</> : (editingMarket ? 'Save Changes' : 'Add Market')}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══ Add / Edit Brand Modal ══ */}
      {showBrandModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5" style={{ backgroundColor: '#53A2FF' }}>
              <div>
                <div className="text-base font-semibold text-white leading-tight">{editingBrand ? 'Edit Brand' : 'Add New Brand'}</div>
                <div className="text-xs text-white/70 mt-0.5">{editingBrand ? 'Update brand details below' : 'Fill in the details to create a new brand'}</div>
              </div>
              <div onClick={closeBrandModal} className="p-1.5 rounded hover:bg-white/20 text-white transition-colors cursor-pointer"><X className="size-4" /></div>
            </div>

            <div className="px-6 py-5 space-y-4 max-h-[60vh] overflow-y-auto">
              {brandSaveError && <AlertBanner type="error" message={brandSaveError} onDismiss={() => setBrandSaveError(null)} />}

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Brand Name <span className="text-red-400">*</span></label>
                <input
                  type="text" value={brandForm.brand_name}
                  onChange={e => { setBrandForm({ ...brandForm, brand_name: e.target.value }); setBrandNameTouched(true); if (e.target.value.trim()) setBrandSaveError(null); }}
                  className={brandNameTouched && !brandForm.brand_name.trim() ? inputErrCls : inputCls}
                  placeholder="e.g. Molina Healthcare"
                />
                {brandNameTouched && !brandForm.brand_name.trim() && (
                  <p className="text-xs text-red-500 mt-1 flex items-center gap-1"><AlertCircle size={11} /> Brand name is required.</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Brand Logo</label>
                <div className="flex items-center gap-3">
                  <div onClick={() => fileInputRef.current?.click()} style={{ color: '#53A2FF', borderColor: '#53A2FF50' }} className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium border rounded-lg hover:bg-[#53A2FF]/5 transition-colors cursor-pointer">
                    <Paperclip className="size-3.5" /> Choose File
                  </div>
                  <span className="text-xs text-slate-500 truncate max-w-60">
                    {logoFile ? logoFile.name : editingBrand?.brand_logo ? logoFilename(editingBrand.brand_logo) : <span className="text-slate-400">No file chosen</span>}
                  </span>
                </div>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={e => setLogoFile(e.target.files?.[0] || null)} />
                <p className="text-xs text-slate-400 mt-1">Accepted: PNG, JPG, JPEG, GIF, SVG, WebP</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Primary Brand Color</label>
                <div className="flex items-center gap-2">
                  <input type="color" value={brandForm.primary_brand_color || '#53A2FF'} onChange={e => setBrandForm({ ...brandForm, primary_brand_color: e.target.value })} className="size-8 rounded-lg border border-slate-200 cursor-pointer p-0.5 shrink-0" />
                  <input type="text" value={brandForm.primary_brand_color} onChange={e => setBrandForm({ ...brandForm, primary_brand_color: e.target.value })} className={inputCls} placeholder="Choose Primary Brand Color" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Secondary Brand Color</label>
                <div className="flex items-center gap-2">
                  <input type="color" value={brandForm.secondary_brand_color || '#a855f7'} onChange={e => setBrandForm({ ...brandForm, secondary_brand_color: e.target.value })} className="size-8 rounded-lg border border-slate-200 cursor-pointer p-0.5 shrink-0" />
                  <input type="text" value={brandForm.secondary_brand_color} onChange={e => setBrandForm({ ...brandForm, secondary_brand_color: e.target.value })} className={inputCls} placeholder="Choose Secondary Brand Color" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Color Palette</label>
                <textarea value={brandForm.color_palette} onChange={e => setBrandForm({ ...brandForm, color_palette: e.target.value })} rows={3} className={`${inputCls} resize-none`} placeholder="Describe the brand color palette…" />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Podcast Guidelines</label>
                <textarea value={brandForm.podcast_guidelines} onChange={e => setBrandForm({ ...brandForm, podcast_guidelines: e.target.value })} rows={3} className={`${inputCls} resize-none`} placeholder="Enter podcast guidelines and tone of voice…" />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-slate-50/50 rounded-b-xl">
              <div onClick={closeBrandModal} className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer">Cancel</div>
              <div onClick={() => { if (!brandSaving) handleBrandSave(); }} style={{ backgroundColor: '#53A2FF' }} className={`flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white rounded-lg hover:opacity-90 transition-opacity shadow-sm ${brandSaving ? 'opacity-60 pointer-events-none cursor-not-allowed' : 'cursor-pointer'}`}>
                {brandSaving && <Loader2 className="size-4 animate-spin" />}
                {editingBrand ? 'Save Changes' : 'Add Brand'}
              </div>
            </div>
          </div>
        </div>
      )}
      {/* ══ Template Modal ══ */}
      {showTemplateModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-5 py-3.5" style={{ backgroundColor: '#53A2FF' }}>
              <div className="text-base font-semibold text-white leading-tight">Add Presentation Template</div>
              <div onClick={() => setShowTemplateModal(false)} className="text-white/80 hover:text-white p-1 rounded hover:bg-white/20 transition-colors cursor-pointer"><X size={18} /></div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {templateModalError && <AlertBanner type="error" message={templateModalError} onDismiss={() => setTemplateModalError(null)} />}
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Template Name <span className="text-red-400">*</span></label>
                  <input
                    className={templateFormTouched && !templateForm.name.trim() ? inputErrCls : inputCls}
                    value={templateForm.name}
                    onChange={e => { setTemplateForm(prev => ({ ...prev, name: e.target.value })); setTemplateFormTouched(true); setTemplateModalError(null); }}
                    placeholder="e.g. Q3 Review Theme"
                    autoFocus
                  />
                  {templateFormTouched && !templateForm.name.trim() && (
                    <p className="text-xs text-red-500 mt-1 flex items-center gap-1"><AlertCircle size={11} /> Name is required.</p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Brand <span className="text-red-400">*</span></label>
                  <select
                    className={templateFormTouched && !templateForm.brand_id ? inputErrCls : inputCls}
                    value={templateForm.brand_id}
                    onChange={e => { setTemplateForm(prev => ({ ...prev, brand_id: e.target.value })); setTemplateFormTouched(true); setTemplateModalError(null); }}
                  >
                    <option value="">— Select Brand —</option>
                    {brands.map(b => <option key={b.brand_id} value={b.brand_id}>{b.brand_name}</option>)}
                  </select>
                  {templateFormTouched && !templateForm.brand_id && (
                    <p className="text-xs text-red-500 mt-1 flex items-center gap-1"><AlertCircle size={11} /> Brand is required.</p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Reference Images <span className="text-red-400">*</span></label>
                <div 
                    onClick={() => templateFileInputRef.current?.click()}
                    className="flex items-center justify-center gap-2 py-2 px-3 border-2 border-dashed border-slate-200 rounded-lg bg-slate-50 hover:bg-slate-100 hover:border-[#53A2FF]/50 transition-colors cursor-pointer"
                >
                    <Upload className="size-4 text-[#53A2FF] opacity-80" />
                    <span className="text-xs font-medium text-slate-700">Click to upload reference slides</span>
                </div>
                <input 
                    ref={templateFileInputRef} 
                    type="file" 
                    multiple 
                    accept="image/*" 
                    className="hidden" 
                    onChange={handleTemplateFileChange} 
                />
              </div>

              {templateReferences.length > 0 && (
                <div className="space-y-1.5">
                  <h4 className="text-[9px] font-medium text-slate-400 uppercase tracking-wide mb-1">Uploaded References</h4>
                  <div className="grid grid-cols-2 gap-2">
                    {templateReferences.map((ref, idx) => (
                      <div key={idx} className="flex gap-2 p-1.5 rounded-lg border border-slate-200 bg-white shadow-sm relative group">
                        <img src={ref.preview} alt="preview" className="w-16 h-11 object-cover rounded shadow-sm border border-slate-100" />
                        <div className="flex-1 flex flex-col justify-center gap-1 min-w-0">
                          <p className="text-[11px] font-medium text-slate-700 truncate pr-5">{ref.file.name}</p>
                          <select 
                            value={ref.layoutType}
                            onChange={(e) => handleTemplateLayoutChange(idx, e.target.value)}
                            className="text-[10px] border border-slate-200 rounded px-1 py-0.5 text-slate-600 focus:outline-none focus:border-[#53A2FF]"
                          >
                            <option value="master">Master Layout</option>
                            <option value="title">Title Slide</option>
                            <option value="content">Content Slide</option>
                            <option value="thank you">Thank You Slide</option>
                            <option value="agenda">Agenda Slide</option>
                          </select>
                        </div>
                        <div 
                          onClick={() => handleRemoveTemplateRef(idx)}
                          title="Remove reference"
                          className="absolute top-2 right-2 size-5 rounded-full bg-slate-100 hover:bg-red-100 text-slate-400 hover:text-red-500 flex items-center justify-center transition-all cursor-pointer shadow-sm"
                        >
                          <X className="size-3" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 px-5 py-4 border-t border-slate-100 bg-slate-50 shrink-0">
              <div onClick={() => setShowTemplateModal(false)} className="px-4 py-2 rounded-lg text-sm text-slate-600 border border-slate-200 hover:bg-white transition-colors cursor-pointer">Cancel</div>
              <div
                onClick={() => { if (!templateSaving) saveTemplateHandler(); }}
                style={{ backgroundColor: '#53A2FF' }}
                className={`flex items-center gap-2 px-5 py-2 rounded-lg text-white text-sm font-semibold hover:opacity-90 transition-opacity whitespace-nowrap ${templateSaving ? 'opacity-60 pointer-events-none cursor-not-allowed' : 'cursor-pointer'}`}
              >
                {templateSaving ? <><Loader2 size={14} className="animate-spin" /> Saving…</> : 'Save Template'}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
