import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, ExternalLink, Image as ImageIcon, Sparkles } from 'lucide-react';
import { Product } from '../../../../domain/types/common.types';
import { apiService } from '../../../../application/services/api.service';

export const AdminStoreManager: React.FC<{ onSuccess: (title: string, msg: string) => void, onError: (title: string, msg: string) => void }> = ({ onSuccess, onError }) => {
    const [products, setProducts] = useState<Product[]>([]);
    const [showModal, setShowModal] = useState(false);
    const [editingProduct, setEditingProduct] = useState<Partial<Product> | null>(null);
    const [loading, setLoading] = useState(false);
    const [fetchingMeta, setFetchingMeta] = useState(false);

    // Form states
    const [title, setTitle] = useState('');
    const [affiliateUrl, setAffiliateUrl] = useState('');
    const [imageUrl, setImageUrl] = useState('');
    const [description, setDescription] = useState('');
    const [price, setPrice] = useState('');
    const [category, setCategory] = useState('geral');

    useEffect(() => {
        loadProducts();
    }, []);

    const loadProducts = async () => {
        try {
            const data = await apiService.getAllProductsAdmin();
            setProducts(data);
        } catch (error) {
            console.error(error);
        }
    };

    const handleFetchMeta = async () => {
        if (!affiliateUrl) return;
        setFetchingMeta(true);
        try {
            const meta = await apiService.fetchProductMetadata(affiliateUrl);
            if (meta.title) setTitle(meta.title);
            if (meta.description) setDescription(meta.description.substring(0, 500));
            if (meta.imageUrl) setImageUrl(meta.imageUrl);
            if (meta.price) setPrice(String(meta.price));
        } catch (error) {
            onError('Erro na Busca', 'Não foi possível buscar dados automaticamente. Tente preencher manualmente.');
        } finally {
            setFetchingMeta(false);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const productData = {
                title,
                affiliateUrl,
                imageUrl,
                description,
                price: price ? parseFloat(price) : undefined,
                category,
                active: true
            };

            if (editingProduct?.id) {
                await apiService.updateProduct(editingProduct.id, productData);
            } else {
                await apiService.createProduct(productData);
            }
            setShowModal(false);
            setEditingProduct(null);
            resetForm();
            loadProducts();
            onSuccess('Sucesso', 'Produto salvo com sucesso!');
        } catch (error) {
            onError('Erro', 'Erro ao salvar o produto');
        } finally {
            setLoading(false);
        }
    };

    const handleEdit = (product: Product) => {
        setEditingProduct(product);
        setTitle(product.title);
        setAffiliateUrl(product.affiliateUrl);
        setImageUrl(product.imageUrl || '');
        setDescription(product.description || '');
        setPrice(product.price ? String(product.price) : '');
        setCategory(product.category);
        setShowModal(true);
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Tem certeza?')) return;
        try {
            await apiService.deleteProduct(id);
            loadProducts();
        } catch (error) {
            onError('Erro', 'Erro ao deletar o produto');
        }
    };

    const resetForm = () => {
        setTitle('');
        setAffiliateUrl('');
        setImageUrl('');
        setDescription('');
        setPrice('');
        setCategory('geral');
    }

    return (
        <div className="bg-surface rounded-3xl border border-surfaceHighlight p-6 mb-8">
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-white">Loja de Afiliados</h3>
                <button onClick={() => { setEditingProduct(null); resetForm(); setShowModal(true); }} className="bg-primary-600 hover:bg-primary-500 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-bold shadow-lg shadow-primary-500/20">
                    <Plus size={16} /> Novo Produto
                </button>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-zinc-400">
                    <thead className="text-xs uppercase bg-black/40 text-zinc-500 font-bold tracking-wider border-b border-zinc-800">
                        <tr>
                            <th className="p-3">Produto</th>
                            <th className="p-3">Preço</th>
                            <th className="p-3">Link</th>
                            <th className="p-3 text-right">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800">
                        {products.length === 0 && (
                            <tr>
                                <td colSpan={4} className="p-4 text-center text-zinc-600 italic">Nenhum produto cadastrado.</td>
                            </tr>
                        )}
                        {products.map(p => (
                            <tr key={p.id} className="hover:bg-white/5 transition">
                                <td className="p-3 flex items-center gap-3 text-white font-medium">
                                    {p.imageUrl ? <img src={p.imageUrl} className="w-10 h-10 rounded-lg object-cover bg-zinc-800" /> : <div className="w-10 h-10 rounded-lg bg-zinc-800 flex items-center justify-center"><ImageIcon size={16} /></div>}
                                    <div>
                                        <div className="font-bold">{p.title}</div>
                                        <div className="text-xs text-zinc-500">{p.category}</div>
                                    </div>
                                </td>
                                <td className="p-3 font-mono text-emerald-400">{p.price ? `R$ ${p.price.toFixed(2)}` : '-'}</td>
                                <td className="p-3 text-primary-400 truncate max-w-[150px] underline text-xs"><a href={p.affiliateUrl} target="_blank">{p.affiliateUrl}</a></td>
                                <td className="p-3 text-right space-x-2">
                                    <button onClick={() => handleEdit(p)} className="p-2 hover:bg-white/10 rounded-lg text-zinc-400 hover:text-white transition"><Edit2 size={16} /></button>
                                    <button onClick={() => handleDelete(p.id)} className="p-2 hover:bg-red-500/10 rounded-lg text-red-500 hover:text-red-400 transition"><Trash2 size={16} /></button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {showModal && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60] p-4 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-surface border border-surfaceHighlight rounded-3xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto shadow-2xl">
                        <h3 className="text-xl font-bold text-white mb-6">{editingProduct ? 'Editar' : 'Novo'} Produto</h3>
                        <form onSubmit={handleSave} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1">Título</label>
                                <input className="w-full bg-black/50 border border-zinc-700 focus:border-primary-500 rounded-xl p-3 text-white outline-none transition" value={title} onChange={e => setTitle(e.target.value)} required placeholder="Ex: iPhone 15" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1">Descrição</label>
                                <textarea className="w-full bg-black/50 border border-zinc-700 focus:border-primary-500 rounded-xl p-3 text-white outline-none transition h-20 resize-none" value={description} onChange={e => setDescription(e.target.value)} placeholder="Breve descrição do produto..." />
                            </div>
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1">URL da Imagem</label>
                                <input className="w-full bg-black/50 border border-zinc-700 focus:border-primary-500 rounded-xl p-3 text-white outline-none transition" value={imageUrl} onChange={e => setImageUrl(e.target.value)} placeholder="https://exemplo.com/imagem.jpg" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1">Link de Afiliado <span className="text-red-500">*</span></label>
                                <div className="flex gap-2">
                                    <input className="w-full bg-black/50 border border-zinc-700 focus:border-primary-500 rounded-xl p-3 text-white outline-none transition" value={affiliateUrl} onChange={e => setAffiliateUrl(e.target.value)} required type="url" placeholder="https://amazon.com/..." />
                                    <button type="button" onClick={handleFetchMeta} disabled={!affiliateUrl || fetchingMeta} className="px-3 bg-purple-600 hover:bg-purple-500 rounded-xl text-white disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center min-w-[50px]" title="Preencher dados automaticamente">
                                        {fetchingMeta ? <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" /> : <Sparkles size={18} />}
                                    </button>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1">Preço (R$)</label>
                                    <input className="w-full bg-black/50 border border-zinc-700 focus:border-primary-500 rounded-xl p-3 text-white outline-none transition" value={price} onChange={e => setPrice(e.target.value)} type="number" step="0.01" placeholder="0.00" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1">Categoria</label>
                                    <input className="w-full bg-black/50 border border-zinc-700 focus:border-primary-500 rounded-xl p-3 text-white outline-none transition" value={category} onChange={e => setCategory(e.target.value)} placeholder="Geral" />
                                </div>
                            </div>
                            <div className="pt-6 flex gap-3">
                                <button type="button" onClick={() => setShowModal(false)} className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white py-3 rounded-xl font-bold transition">Cancelar</button>
                                <button type="submit" disabled={loading} className="flex-1 bg-primary-600 hover:bg-primary-500 text-white py-3 rounded-xl font-bold transition shadow-lg shadow-primary-900/20">{loading ? 'Salvando...' : 'Salvar Produto'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
