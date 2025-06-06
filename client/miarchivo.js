document.addEventListener('DOMContentLoaded', function() {
    // Elementos del buscador
    const searchButton = document.getElementById('search-button');
    const searchInput = document.getElementById('search-input');
    const searchResults = document.getElementById('search-results');
    const API_KEY = 'dacfb2cd9ac175ba2147fb6a9e248856';
    const FIXTURES_API_URL = 'https://v3.football.api-sports.io/fixtures?league=4&season=2023&timezone=Europe/Madrid';

    // --- BÚSQUEDA DE EQUIPOS ---
    function showResults(results) {
        searchResults.innerHTML = '';
        searchResults.style.display = 'block';

        if (!results || results.length === 0) {
            searchResults.innerHTML = '<div>No se encontraron resultados</div>';
            return;
        }

        results.forEach(item => {
            const div = document.createElement('div');
            div.classList.add('search-result-item');
            div.style.cursor = 'pointer';
            div.innerHTML = `
                <h3>${item.team.name}</h3>
                <p>País: ${item.team.country}</p>
                <img src="${item.team.logo}" alt="${item.team.name}" width="50">
            `;
            div.addEventListener('click', () => {
                window.location.href = `equipo.html?id=${item.team.id}`;
            });
            searchResults.appendChild(div);
        });
    }

    async function buscarEquipos(query) {
        const url = `https://v3.football.api-sports.io/teams?search=${encodeURIComponent(query)}`;
        try {
            const response = await fetch(url, {
                headers: { 'x-apisports-key': API_KEY }
            });
            
            if (!response.ok) {
                throw new Error(`Error HTTP: ${response.status}`);
            }
            
            const data = await response.json();
            showResults(data.response || []);
        } catch (error) {
            searchResults.innerHTML = '<div>Error al obtener datos</div>';
            searchResults.style.display = 'block';
            console.error('Error:', error);
        }
    }

    // Eventos del buscador
    searchButton.addEventListener('click', () => {
        const query = searchInput.value.trim();
        if (query) buscarEquipos(query);
    });

    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && searchInput.value.trim()) {
            buscarEquipos(searchInput.value.trim());
        }
    });

    document.addEventListener('click', (e) => {
        if (!searchResults.contains(e.target) && e.target !== searchInput && e.target !== searchButton) {
            searchResults.style.display = 'none';
        }
    });

    // --- PARTIDOS EN VIVO ---
    async function fetchMatches() {
        try {
            const response = await fetch(FIXTURES_API_URL, {
                headers: { 'x-apisports-key': API_KEY }
            });
            
            if (!response.ok) {
                throw new Error(`Error HTTP: ${response.status}`);
            }
            
            const data = await response.json();
            displayMatches(data.response || []);
        } catch (error) {
            console.error('Error fetching matches:', error);
            
            // Mostrar datos de ejemplo si falla la API
            displayMatches([{
                teams: {
                    home: { name: 'Barcelona', logo: 'img/teams/barca.png' },
                    away: { name: 'Real Madrid', logo: 'img/teams/madrid.png' }
                },
                goals: { home: 1, away: 1 },
                fixture: {
                    status: { short: '1H' },
                    date: new Date().toISOString()
                }
            }]);
        }
    }

    function displayMatches(matches) {
        const liveContainer = document.getElementById('live-matches');
        const upcomingContainer = document.getElementById('upcoming-matches');
        
        liveContainer.innerHTML = '<p class="loading">Cargando partidos en vivo...</p>';
        upcomingContainer.innerHTML = '<p class="loading">Cargando próximos partidos...</p>';

        if (!matches || matches.length === 0) {
            liveContainer.innerHTML = '<p>Esta funcion no esta disponible todavia</p>';
            upcomingContainer.innerHTML = '<p>Esta funcion no esta disponible todavia</p>';
            return;
        }

        liveContainer.innerHTML = '';
        upcomingContainer.innerHTML = '';

        matches.forEach(match => {
            const isLive = ['1H', '2H', 'HT', 'ET', 'P', 'BT'].includes(match.fixture?.status?.short);
            const isFinished = match.fixture?.status?.short === 'FT';
            const matchCard = createMatchCard(match, isLive);
            
            isLive ? liveContainer.appendChild(matchCard) : 
            !isFinished && upcomingContainer.appendChild(matchCard);
        });

        if (liveContainer.children.length === 0) {
            liveContainer.innerHTML = '<p>No hay partidos en vivo</p>';
        }
        
        if (upcomingContainer.children.length === 0) {
            upcomingContainer.innerHTML = '<p>No hay próximos partidos</p>';
        }
    }

    function createMatchCard(match, isLive) {
        const matchCard = document.createElement('div');
        matchCard.className = 'match-card';
        
        const homeTeam = match.teams?.home || { name: 'Equipo Local', logo: '' };
        const awayTeam = match.teams?.away || { name: 'Equipo Visitante', logo: '' };
        const score = match.goals ? `${match.goals.home}-${match.goals.away}` : '0-0';
        const matchTime = match.fixture?.date ? 
            new Date(match.fixture.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 
            'Hora no disponible';

        matchCard.innerHTML = `
            <div class="team">
                <img src="${homeTeam.logo || 'img/placeholder.png'}" alt="${homeTeam.name}">
                <span>${homeTeam.name}</span>
            </div>
            
            <div class="score">
                ${isLive ? 'LIVE' : match.fixture?.status?.short === 'FT' ? score : matchTime}
            </div>
            
            <div class="team">
                <img src="${awayTeam.logo || 'img/placeholder.png'}" alt="${awayTeam.name}">
                <span>${awayTeam.name}</span>
            </div>
            
            <span class="match-status">
                ${isLive ? 'EN VIVO' : match.fixture?.status?.short === 'FT' ? 'FINALIZADO' : 'PRÓXIMO'}
            </span>
        `;
        
        return matchCard;
    }

    // Iniciar
    fetchMatches();  
});
