(function() {
    'use strict';
    
    // words.txt 中的内容（按行存储）
    const words = [
        "人间道理万卷书，只求随心随性行",
        "宜观星辰辨南北，勿随萤火逐东西", 
        "日拱一卒无有尽，功不唐捐终入海",
        "莫思身外无穷事，且尽生前有限杯",
        "何须更问浮生事，只此浮生是梦中",
        "欲买桂花同载酒，终不似，少年游"
    ];
    
    // 获取当前日期作为索引
    function getDayIndex() {
        const now = new Date();
        // 计算从某个固定日期（比如2024年1月1日）开始的天数
        const startDate = new Date('2024-01-01');
        const diffTime = Math.abs(now - startDate);
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        return diffDays % words.length;
    }
    
    // 更新网站标题
    function updateSiteTitle() {
        const siteTitle = document.getElementById('site-title');
        if (siteTitle) {
            const dayIndex = getDayIndex();
            siteTitle.textContent = words[dayIndex];
        }
    }
    
    // 页面加载完成后执行
    function onReady(fn) {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', fn, {once: true});
        } else {
            fn();
        }
    }
    
    // 初始化
    onReady(function() {
        updateSiteTitle();
    });
    
    // 支持 PJAX（如果启用了的话）
    if (typeof document !== 'undefined') {
        document.addEventListener('pjax:complete', updateSiteTitle);
    }
})();