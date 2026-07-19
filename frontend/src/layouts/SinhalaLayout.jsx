import { useLayoutEffect, useRef } from 'react';
import { Outlet } from 'react-router-dom';
import HeaderLayout from './HeaderLayout.jsx';
import SidebarLayout from './SidebarLayout.jsx';
import { translateSinhala } from '../utils/sinhalaTranslations.js';

const translatableAttributes = ['aria-label', 'placeholder', 'title'];

const translateTextNode = (node) => {
  const translated = translateSinhala(node.nodeValue);

  if (translated !== node.nodeValue) {
    node.nodeValue = translated;
  }
};

const translateElementAttributes = (element) => {
  if (element.tagName === 'OPTION' && !element.hasAttribute('value')) {
    element.setAttribute('value', element.textContent.trim());
  }

  translatableAttributes.forEach((attribute) => {
    if (!element.hasAttribute?.(attribute)) {
      return;
    }

    const value = element.getAttribute(attribute);
    const translated = translateSinhala(value);

    if (translated !== value) {
      element.setAttribute(attribute, translated);
    }
  });
};

const translateTree = (root) => {
  if (!root) {
    return;
  }

  if (root.nodeType === Node.TEXT_NODE) {
    translateTextNode(root);
    return;
  }

  if (root.nodeType !== Node.ELEMENT_NODE) {
    return;
  }

  translateElementAttributes(root);

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  let node = walker.nextNode();

  while (node) {
    if (node.nodeType === Node.TEXT_NODE) {
      translateTextNode(node);
    } else {
      translateElementAttributes(node);
    }

    node = walker.nextNode();
  }
};

const SinhalaLayout = () => {
  const shellRef = useRef(null);

  useLayoutEffect(() => {
    const shell = shellRef.current;

    if (!shell) {
      return undefined;
    }

    translateTree(shell);

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'characterData') {
          translateTextNode(mutation.target);
          return;
        }

        if (mutation.type === 'attributes') {
          translateElementAttributes(mutation.target);
          return;
        }

        mutation.addedNodes.forEach(translateTree);
      });
    });

    observer.observe(shell, {
      attributes: true,
      attributeFilter: translatableAttributes,
      characterData: true,
      childList: true,
      subtree: true
    });

    return () => observer.disconnect();
  }, []);

  return (
    <div className="app-shell sinhala-shell" lang="si" ref={shellRef}>
      <SidebarLayout />
      <div className="main-shell">
        <HeaderLayout />
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default SinhalaLayout;
