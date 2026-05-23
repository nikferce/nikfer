// ============================================================
// Nikfer Belleği — Veritabanı Katmanı
// ============================================================
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ── SECTIONS ─────────────────────────────────────────────────

export async function getSections() {
  const { data, error } = await supabase
    .from('sections')
    .select('*')
    .eq('is_visible', true)
    .order('sort_order');
  if (error) throw error;
  return data;
}

export async function getSectionBySlug(slug) {
  const { data, error } = await supabase
    .from('sections')
    .select('*')
    .eq('slug', slug)
    .single();
  if (error) throw error;
  return data;
}

// ── CONTENT BLOCKS ───────────────────────────────────────────

export async function getContentBlocks(sectionId) {
  const { data, error } = await supabase
    .from('content_blocks')
    .select('*')
    .eq('section_id', sectionId)
    .order('sort_order');
  if (error) throw error;
  return data;
}

export async function getSectionWithContent(slug) {
  const section = await getSectionBySlug(slug);
  const blocks  = await getContentBlocks(section.id);
  const audio   = await getAudioFiles(section.id);
  const links   = await getLinks(section.id);
  const gallery = await getGallery(section.id);
  return { section, blocks, audio, links, gallery };
}

// ── AUDIO ────────────────────────────────────────────────────

export async function getAudioFiles(sectionId) {
  const { data, error } = await supabase
    .from('audio_files')
    .select('*')
    .eq('section_id', sectionId)
    .order('sort_order');
  if (error) throw error;
  return data;
}

export function getPublicUrl(filePath) {
  const { data } = supabase
    .storage
    .from('nikfer-media')
    .getPublicUrl(filePath);
  return data.publicUrl;
}

// ── LINKS ────────────────────────────────────────────────────

export async function getLinks(sectionId) {
  const { data, error } = await supabase
    .from('links')
    .select('*')
    .eq('section_id', sectionId)
    .order('sort_order');
  if (error) throw error;
  return data;
}

// ── GALLERY ──────────────────────────────────────────────────

export async function getGallery(sectionId) {
  const { data, error } = await supabase
    .from('gallery')
    .select('*')
    .eq('section_id', sectionId)
    .order('sort_order');
  if (error) throw error;
  return data;
}

// ── COMMENTS ─────────────────────────────────────────────────

export async function getApprovedComments(sectionId = null) {
  let query = supabase
    .from('comments')
    .select('*')
    .eq('is_approved', true)
    .order('is_pinned', { ascending: false })
    .order('created_at', { ascending: false });

  if (sectionId) query = query.eq('section_id', sectionId);

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function submitComment({ sectionId, authorName, authorNote, content }) {
  const { data, error } = await supabase
    .from('comments')
    .insert({
      section_id:  sectionId,
      author_name: authorName,
      author_note: authorNote,
      content,
      is_approved: false
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ── REALTIME (canlı yorum güncellemesi) ──────────────────────

export function subscribeComments(sectionId, callback) {
  return supabase
    .channel(`comments-${sectionId}`)
    .on(
      'postgres_changes',
      {
        event:  'INSERT',
        schema: 'public',
        table:  'comments',
        filter: `section_id=eq.${sectionId}`
      },
      (payload) => {
        if (payload.new.is_approved) callback(payload.new);
      }
    )
    .subscribe();
}

// ── AUTH ─────────────────────────────────────────────────────

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export function onAuthChange(callback) {
  return supabase.auth.onAuthStateChange((event, session) => {
    callback(event, session);
  });
}

// ── ADMIN: SECTIONS ──────────────────────────────────────────

export async function createSection(payload) {
  const { data, error } = await supabase
    .from('sections')
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateSection(id, payload) {
  const { data, error } = await supabase
    .from('sections')
    .update(payload)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteSection(id) {
  const { error } = await supabase
    .from('sections')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

// ── ADMIN: CONTENT BLOCKS ────────────────────────────────────

export async function createBlock(payload) {
  const { data, error } = await supabase
    .from('content_blocks')
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateBlock(id, payload) {
  const { data, error } = await supabase
    .from('content_blocks')
    .update(payload)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteBlock(id) {
  const { error } = await supabase
    .from('content_blocks')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

// ── ADMIN: AUDIO ─────────────────────────────────────────────

export async function uploadAudio(sectionId, file, title) {
  const ext      = file.name.split('.').pop();
  const filePath = `audio/${sectionId}/${Date.now()}.${ext}`;

  const { error: upErr } = await supabase
    .storage
    .from('nikfer-media')
    .upload(filePath, file);
  if (upErr) throw upErr;

  const publicUrl = getPublicUrl(filePath);

  const { data, error } = await supabase
    .from('audio_files')
    .insert({ section_id: sectionId, title, file_path: filePath, file_url: publicUrl })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateAudio(id, payload) {
  const { data, error } = await supabase
    .from('audio_files')
    .update(payload)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteAudio(id, filePath) {
  await supabase.storage.from('nikfer-media').remove([filePath]);
  const { error } = await supabase.from('audio_files').delete().eq('id', id);
  if (error) throw error;
}

// ── ADMIN: GALLERY ───────────────────────────────────────────

export async function uploadImage(sectionId, file, title, caption) {
  const ext      = file.name.split('.').pop();
  const filePath = `gallery/${sectionId}/${Date.now()}.${ext}`;

  const { error: upErr } = await supabase
    .storage
    .from('nikfer-media')
    .upload(filePath, file);
  if (upErr) throw upErr;

  const publicUrl = getPublicUrl(filePath);

  const { data, error } = await supabase
    .from('gallery')
    .insert({ section_id: sectionId, title, caption, file_path: filePath, file_url: publicUrl })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateImage(id, payload) {
  const { data, error } = await supabase
    .from('gallery')
    .update(payload)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteImage(id, filePath) {
  await supabase.storage.from('nikfer-media').remove([filePath]);
  const { error } = await supabase.from('gallery').delete().eq('id', id);
  if (error) throw error;
}

// ── ADMIN: LINKS ─────────────────────────────────────────────

export async function createLink(payload) {
  const { data, error } = await supabase
    .from('links')
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateLink(id, payload) {
  const { data, error } = await supabase
    .from('links')
    .update(payload)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteLink(id) {
  const { error } = await supabase.from('links').delete().eq('id', id);
  if (error) throw error;
}

// ── ADMIN: COMMENTS ──────────────────────────────────────────

export async function getAllComments() {
  const { data, error } = await supabase
    .from('comments')
    .select('*, sections(title)')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function approveComment(id) {
  const { data, error } = await supabase
    .from('comments')
    .update({ is_approved: true })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function pinComment(id, pinned) {
  const { data, error } = await supabase
    .from('comments')
    .update({ is_pinned: pinned })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteComment(id) {
  const { error } = await supabase.from('comments').delete().eq('id', id);
  if (error) throw error;
}
