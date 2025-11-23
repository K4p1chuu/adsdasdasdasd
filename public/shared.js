// === Sprawdzenie autoryzacji (Globalne) ===
(function() {
    const token = localStorage.getItem('token') || localStorage.getItem('mdt-token');
    // Dodajemy cepik-login do wyjątków
    const isLoginPage = window.location.pathname.endsWith('/') || 
                        window.location.pathname.includes('index.html') || 
                        window.location.pathname.includes('cepik-login.html');
    
    if (!token && !isLoginPage) {
        console.log('Brak tokenu, przekierowanie do logowania.');
        window.location.href = 'index.html';
    }
})();

if (typeof lucide === 'undefined') {
    const script = document.createElement('script');
    script.src = "https://unpkg.com/lucide@latest";
    document.head.appendChild(script);
}

async function loadSidebarAndUserData(activePage) {
    const token = localStorage.getItem('token') || localStorage.getItem('mdt-token');
    if (!token) { window.location.href = 'index.html'; return null; }

    try {
        const response = await fetch('/api/user-data', {
            headers: { 'Authorization': token }
        });

        if (!response.ok) {
            // Jeśli serwer odrzuci token (401), wyloguj
            localStorage.removeItem('token');
            localStorage.removeItem('mdt-token');
            window.location.href = 'index.html';
            throw new Error('Błąd autoryzacji');
        }

        const { userData } = await response.json();
        const sidebarContainer = document.getElementById('sidebar-container') || document.querySelector('.w-64');
        
        if (sidebarContainer) {
            sidebarContainer.innerHTML = ''; 

            // === 1. UERD ===
            if (userData.department === 'UERD') {
                sidebarContainer.innerHTML = `
                    <div class="flex items-center mb-6 justify-center border-b border-gray-700 pb-4 p-4">
                         <h1 class="text-2xl font-bold text-red-500 tracking-wider">UERD</h1>
                    </div>
                    <nav class="flex-grow space-y-2 p-2">
                        <a href="uerd.html" class="sidebar-link flex items-center px-3 py-2 rounded-lg text-white bg-red-700 hover:bg-red-600"><i data-lucide="activity" class="w-5 h-5 mr-3"></i> Panel UERD</a>
                    </nav>
                    ${renderUserFooter(userData, 'red')}
                `;
            } 
            // === 2. DOT (WISDOT) ===
            else if (userData.department === 'DOT') {
                sidebarContainer.innerHTML = `
                    <div class="flex items-center mb-6 justify-center border-b border-gray-700 pb-4 p-4">
                         <h1 class="text-2xl font-bold text-yellow-500 tracking-wider">WisDOT</h1>
                    </div>
                    <nav class="flex-grow space-y-2 p-2">
                        <a href="dot-panel.html" class="sidebar-link ${activePage === 'dot-panel' ? 'bg-yellow-600 text-black font-bold' : 'text-gray-300 hover:bg-gray-800'} flex items-center px-3 py-2 rounded-lg mb-1"><i data-lucide="layout-dashboard" class="w-5 h-5 mr-3"></i> Strona Główna</a>
                        <a href="dot-invoices.html" class="sidebar-link ${activePage === 'dot-invoices' ? 'bg-yellow-600 text-black font-bold' : 'text-gray-300 hover:bg-gray-800'} flex items-center px-3 py-2 rounded-lg mb-1"><i data-lucide="file-text" class="w-5 h-5 mr-3"></i> Faktury</a>
                        <a href="dot-reports.html" class="sidebar-link ${activePage === 'dot-reports' ? 'bg-yellow-600 text-black font-bold' : 'text-gray-300 hover:bg-gray-800'} flex items-center px-3 py-2 rounded-lg mb-1"><i data-lucide="clipboard-list" class="w-5 h-5 mr-3"></i> Raporty</a>
                        <a href="dot-parking.html" class="sidebar-link ${activePage === 'dot-parking' ? 'bg-yellow-600 text-black font-bold' : 'text-gray-300 hover:bg-gray-800'} flex items-center px-3 py-2 rounded-lg mb-1"><i data-lucide="truck" class="w-5 h-5 mr-3"></i> Parking</a>
                        ${(userData.isAdmin || userData.rank.includes('01')) ? `<a href="dot-admin.html" class="sidebar-link text-red-400 hover:bg-gray-800 flex items-center px-3 py-2 rounded-lg mb-1"><i data-lucide="shield-alert" class="w-5 h-5 mr-3"></i> Admin</a>` : ''}
                    </nav>
                    ${renderUserFooter(userData, 'yellow')}
                `;
            }
            // === 3. CEPIK (DIAGNOSTA) ===
            else if (userData.isDiagnostician) {
                sidebarContainer.innerHTML = `
                    <div class="flex items-center mb-6 justify-center border-b border-gray-700 pb-4 p-4">
                         <h1 class="text-2xl font-bold text-green-500 tracking-wider">CEPIK</h1>
                    </div>
                    <nav class="flex-grow space-y-2 p-2">
                        <a href="cepik.html" class="sidebar-link flex items-center px-3 py-2 rounded-lg text-white bg-green-700 hover:bg-green-600"><i data-lucide="car" class="w-5 h-5 mr-3"></i> Panel Diagnosty</a>
                    </nav>
                    ${renderUserFooter(userData, 'green')}
                `;
            }
            // === 4. POLICJA ===
            else {
                // Tutaj wklejasz standardowy kod HTML dla policji (z poprzednich odpowiedzi),
                // który zawiera przyciski GŁÓWNE, BAZY DANYCH itd.
                // Dla czytelności skróciłem go tutaj, ale upewnij się, że jest pełny.
                sidebarContainer.innerHTML = `
                    <div class="flex items-center mb-6 p-4"><img src="ocsowsp.png" class="h-16 w-auto mx-auto"></div>
                    <nav class="flex-grow space-y-2 p-2">
                        <a href="dashboard.html" class="sidebar-link ${activePage==='dashboard'?'active bg-gray-700 text-white':'text-gray-400'} flex px-3 py-2 rounded-lg"><i data-lucide="layout-dashboard" class="mr-3 w-5"></i> Panel Główny</a>
                        <a href="database.html" class="sidebar-link flex px-3 py-2 text-gray-400 hover:bg-gray-700 rounded-lg"><i data-lucide="database" class="mr-3 w-5"></i> Kartoteka</a>
                        <!-- Reszta linków policyjnych -->
                    </nav>
                    ${renderUserFooter(userData, 'red')}
                `;
            }

            if (window.lucide) window.lucide.createIcons();
            else setTimeout(() => window.lucide && window.lucide.createIcons(), 500);
        }
        return userData;
    } catch (error) {
        console.error(error);
        return null;
    }
}

function renderUserFooter(userData, color) {
    return `
        <div class="mt-auto p-4 border-t border-gray-700">
            <p class="text-sm font-bold text-white">${userData.username}</p>
            <p class="text-xs text-gray-400">${userData.rank || 'Pracownik'}</p>
            <a href="#" id="logout-button" class="flex items-center mt-2 px-3 py-2 rounded text-gray-400 hover:text-white hover:bg-${color}-900">
                <i data-lucide="log-out" class="w-4 h-4 mr-2"></i> Wyloguj
            </a>
        </div>
    `;
}

document.addEventListener('click', function(e) {
    if (e.target && e.target.closest('#logout-button')) {
        e.preventDefault();
        localStorage.clear(); // Czyści wszystko
        window.location.href = 'index.html';
    }
});

document.addEventListener("DOMContentLoaded", () => {
    const page = window.location.pathname.split('/').pop().replace('.html', '');
    if (page && page !== 'index' && page !== 'cepik-login') {
        loadSidebarAndUserData(page);
    }
});