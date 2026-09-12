document.addEventListener('DOMContentLoaded',()=>{
  const menu=document.querySelector('.menu');
  const links=document.querySelector('.links');
  if(menu&&links){menu.addEventListener('click',()=>links.classList.toggle('open'));links.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>links.classList.remove('open')))}
  const search=document.querySelector('[data-search]');
  const cards=[...document.querySelectorAll('[data-searchable]')];
  if(search&&cards.length){search.addEventListener('input',()=>{const q=search.value.trim().toLowerCase();cards.forEach(c=>{c.classList.toggle('hidden',q&&!c.textContent.toLowerCase().includes(q))})})}
  document.querySelectorAll('[data-year]').forEach(el=>el.textContent=new Date().getFullYear());
});
