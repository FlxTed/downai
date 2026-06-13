import { ChevronRight, ChevronDown, Folder, FolderOpen, RefreshCw, ChevronDown as CollapseIcon, FilePlus, FolderPlus, Star } from 'lucide-react';

import { useState, useEffect, useRef } from 'react';

import { useEditorStore, FileNode } from '../store/editorStore';
import { useBookmarksStore } from '../store/bookmarksStore';

import { FileIcon } from '../utils/fileIcons';

import styles from './Sidebar.module.css';



interface ContextMenuState {

  x: number;

  y: number;

  path: string;

  type: 'file' | 'folder';

}



function TreeNode({ node, depth = 0 }: { node: FileNode; depth?: number }) {

  const {

    expandedFolders, toggleFolder, openFile, activeFilePath,

    explorerHighlightPath,

  } = useEditorStore();

  const isExpanded = expandedFolders.has(node.path);

  const isActive = activeFilePath === node.path;

  const isHighlighted = explorerHighlightPath === node.path;

  const itemRef = useRef<HTMLButtonElement>(null);



  useEffect(() => {

    if (isHighlighted && itemRef.current) {

      itemRef.current.scrollIntoView({ block: 'nearest' });

    }

  }, [isHighlighted]);



  const onContext = (e: React.MouseEvent) => {

    e.preventDefault();

    window.dispatchEvent(new CustomEvent('sidebar:context', {

      detail: { x: e.clientX, y: e.clientY, path: node.path, type: node.type },

    }));

  };



  if (node.type === 'folder') {

    return (

      <div>

        <button

          ref={itemRef}

          className={`${styles.treeItem} ${isHighlighted ? styles.highlighted : ''}`}

          style={{ paddingLeft: 8 + depth * 12 }}

          onClick={() => toggleFolder(node.path)}

          onContextMenu={onContext}

        >

          {isExpanded ? <ChevronDown size={16} strokeWidth={1.5} /> : <ChevronRight size={16} strokeWidth={1.5} />}

          {isExpanded

            ? <FolderOpen size={16} className={styles.folderIcon} strokeWidth={1.5} />

            : <Folder size={16} className={styles.folderIcon} strokeWidth={1.5} />}

          <span className={styles.itemName}>{node.name}</span>

        </button>

        {isExpanded && node.children?.map(child => (

          <TreeNode key={child.path} node={child} depth={depth + 1} />

        ))}

      </div>

    );

  }



  return (

    <button

      ref={itemRef}

      className={`${styles.treeItem} ${isActive ? styles.active : ''} ${isHighlighted ? styles.highlighted : ''}`}

      style={{ paddingLeft: 24 + depth * 12 }}

      onClick={() => openFile(node.path)}

      onContextMenu={onContext}

    >

      <FileIcon name={node.name} />

      <span className={styles.itemName}>{node.name}</span>

    </button>

  );

}



export function Sidebar() {

  const {

    fileTree, projectPath, refreshTree, createFile, createFolder,
    deletePath, renamePath, revealInExplorer, openFile,
  } = useEditorStore();

  const [collapsed, setCollapsed] = useState(false);

  const [menu, setMenu] = useState<ContextMenuState | null>(null);
  const { load: loadBookmarks, list: listBookmarks, toggle: toggleBookmark, isPinned } = useBookmarksStore();

  const folderName = projectPath?.split(/[/\\]/).pop() || 'Project';
  const pinned = projectPath ? listBookmarks(projectPath) : [];

  useEffect(() => { void loadBookmarks(); }, [loadBookmarks]);



  useEffect(() => {

    const onContext = (e: Event) => {

      const detail = (e as CustomEvent<ContextMenuState>).detail;

      setMenu(detail);

    };

    window.addEventListener('sidebar:context', onContext);

    return () => window.removeEventListener('sidebar:context', onContext);

  }, []);



  useEffect(() => {

    if (!menu) return;

    const close = () => setMenu(null);

    window.addEventListener('click', close);

    window.addEventListener('scroll', close, true);

    return () => {

      window.removeEventListener('click', close);

      window.removeEventListener('scroll', close, true);

    };

  }, [menu]);



  const onNewFile = async () => {

    const name = window.prompt('New file name (e.g. index.ts)');

    if (name?.trim()) await createFile(name.trim());

  };



  const onNewFolder = async () => {

    const name = window.prompt('New folder name');

    if (name?.trim()) await createFolder(name.trim());

  };



  const runMenuAction = async (action: string) => {

    if (!menu) return;

    const { path, type } = menu;

    setMenu(null);

    switch (action) {

      case 'rename': {

        const next = window.prompt('Rename to', path.split('/').pop());

        if (!next?.trim()) return;

        const parent = path.includes('/') ? path.slice(0, path.lastIndexOf('/') + 1) : '';

        await renamePath(path, parent + next.trim());

        break;

      }

      case 'copy-path':
        await window.downai.clipboard.write(path);
        break;

      case 'pin':
        if (projectPath && type === 'file') toggleBookmark(projectPath, path);
        break;

      case 'reveal':

        revealInExplorer(path);

        break;

      case 'delete':

        await deletePath(path);

        break;

    }

  };



  return (

    <aside className={styles.sidebar}>

      <div className={styles.sectionHeader}>

        <button className={styles.sectionToggle} onClick={() => setCollapsed(v => !v)}>

          <CollapseIcon size={14} className={collapsed ? styles.collapsed : ''} />

          <span>Explorer</span>

        </button>

        <div className={styles.headerActions}>

          <button className={styles.headerBtn} onClick={onNewFile} title="New File">

            <FilePlus size={14} strokeWidth={1.5} />

          </button>

          <button className={styles.headerBtn} onClick={onNewFolder} title="New Folder">

            <FolderPlus size={14} strokeWidth={1.5} />

          </button>

          <button className={styles.headerBtn} onClick={refreshTree} title="Refresh">

            <RefreshCw size={14} strokeWidth={1.5} />

          </button>

        </div>

      </div>

      {!collapsed && (

        <>

          <div className={styles.projectName}>{folderName}</div>

          {pinned.length > 0 && (
            <div className={styles.pinnedSection}>
              <div className={styles.pinnedLabel}>Pinned</div>
              {pinned.map(p => (
                <button key={p} className={styles.pinnedItem} onClick={() => openFile(p)}>
                  <Star size={12} fill="currentColor" />
                  <span>{p.split('/').pop()}</span>
                </button>
              ))}
            </div>
          )}

          <div className={styles.tree}>

            {fileTree.map(node => (

              <TreeNode key={node.path} node={node} />

            ))}

          </div>

        </>

      )}

      {menu && (

        <div className={styles.contextMenu} style={{ top: menu.y, left: menu.x }}>

          <button type="button" onClick={() => runMenuAction('reveal')}>Reveal in Explorer</button>
          <button type="button" onClick={() => runMenuAction('copy-path')}>Copy Path</button>
          {menu.type === 'file' && projectPath && (
            <button type="button" onClick={() => runMenuAction('pin')}>
              {isPinned(projectPath, menu.path) ? 'Unpin' : 'Pin file'}
            </button>
          )}
          <button type="button" onClick={() => runMenuAction('rename')}>Rename</button>

          <button type="button" className={styles.danger} onClick={() => runMenuAction('delete')}>Delete</button>

        </div>

      )}

    </aside>

  );

}

