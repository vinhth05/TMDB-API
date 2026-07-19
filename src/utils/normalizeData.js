const config = require('../config/config');

const getImageUrl = (path, size = null) => {
  if (!path) return null;
  const base = config.tmdb.imageBase.replace(/\/$/, '');
  const finalSize = size || config.tmdb.imageSize;
  return `${base}/${finalSize}${path}`;
};

const normalizePagination = (data) => {
  if (!data || data.page === undefined) return null;
  return {
    page: data.page,
    pageSize: 20, // TMDB defaults to 20
    totalPages: data.total_pages,
    totalResults: data.total_results,
    hasNext: data.page < data.total_pages,
    hasPrevious: data.page > 1
  };
};

const normalizeMovieSearchItem = (movie) => {
  if (!movie) return null;
  return {
    tmdbId: movie.id,
    title: movie.title,
    originalTitle: movie.original_title || null,
    overview: movie.overview || null,
    originalLanguage: movie.original_language || null,
    releaseDate: movie.release_date || null,
    releaseYear: movie.release_date ? parseInt(movie.release_date.substring(0, 4), 10) : null,
    posterPath: movie.poster_path || null,
    posterUrl: getImageUrl(movie.poster_path),
    backdropPath: movie.backdrop_path || null,
    backdropUrl: getImageUrl(movie.backdrop_path),
    genreIds: movie.genre_ids || [],
    adult: movie.adult || false,
    popularity: movie.popularity || 0,
    voteAverage: movie.vote_average || 0,
    voteCount: movie.vote_count || 0
  };
};

const normalizeCredits = (credits) => {
  if (!credits) return { directors: [], writers: [], producers: [], mainCast: [], supportingCast: [], crew: [] };

  const targetCrewJobs = [
    'Director', 'Assistant Director', 'Producer', 'Executive Producer',
    'Screenplay', 'Writer', 'Story', 'Original Story', 'Novel',
    'Music', 'Original Music Composer', 'Director of Photography',
    'Editor', 'Casting', 'Costume Design', 'Art Director',
    'Production Design', 'Visual Effects', 'Animation', 'Sound'
  ];

  const filteredCrew = (credits.crew || []).filter(c => targetCrewJobs.includes(c.job));
  const getCrewByJobs = (jobs) => {
    const seen = new Set();
    return filteredCrew.filter(c => jobs.includes(c.job)).map(c => ({
      tmdbPersonId: c.id,
      name: c.name,
      originalName: c.original_name,
      profilePath: c.profile_path || null,
      profileUrl: getImageUrl(c.profile_path),
      department: c.department,
      job: c.job
    })).filter(c => {
      // deduplicate by id and job
      const key = `${c.tmdbPersonId}_${c.job}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };

  const castList = (credits.cast || []).map(c => ({
    tmdbPersonId: c.id,
    name: c.name,
    character: c.character,
    order: c.order,
    profileUrl: getImageUrl(c.profile_path),
    knownForDepartment: c.known_for_department
  })).sort((a, b) => a.order - b.order);

  return {
    directors: getCrewByJobs(['Director']),
    writers: getCrewByJobs(['Screenplay', 'Writer', 'Story', 'Original Story', 'Novel']),
    producers: getCrewByJobs(['Producer', 'Executive Producer']),
    mainCast: castList.slice(0, 10),
    supportingCast: castList.slice(10),
    crew: getCrewByJobs(targetCrewJobs.filter(j => !['Director', 'Screenplay', 'Writer', 'Story', 'Original Story', 'Novel', 'Producer', 'Executive Producer'].includes(j)))
  };
};

const normalizeVideos = (videos, requestedLanguage = null) => {
  if (!videos || !videos.results) return { primaryTrailer: null, trailers: [], teasers: [], clips: [], featurettes: [], other: [] };

  const allVideos = videos.results.map(v => ({
    tmdbVideoId: v.id,
    name: v.name,
    site: v.site,
    type: v.type,
    key: v.key,
    url: v.site === 'YouTube' ? `https://www.youtube.com/watch?v=${v.key}` : null,
    embedUrl: v.site === 'YouTube' ? `https://www.youtube.com/embed/${v.key}` : null,
    official: v.official,
    publishedAt: v.published_at,
    language: v.iso_639_1,
    country: v.iso_3166_1
  }));

  const trailers = allVideos.filter(v => v.type === 'Trailer');
  const teasers = allVideos.filter(v => v.type === 'Teaser');
  const clips = allVideos.filter(v => v.type === 'Clip');
  const featurettes = allVideos.filter(v => v.type === 'Featurette');
  const other = allVideos.filter(v => !['Trailer', 'Teaser', 'Clip', 'Featurette'].includes(v.type));

  // Primary trailer selection
  let primaryTrailer = null;
  const youtubeTrailers = trailers.filter(v => v.site === 'YouTube');
  
  if (youtubeTrailers.length > 0) {
    const lang = requestedLanguage ? requestedLanguage.split('-')[0] : 'vi';
    
    primaryTrailer = 
      youtubeTrailers.find(v => v.official && v.language === lang) ||
      youtubeTrailers.find(v => v.official && v.language === 'en') ||
      youtubeTrailers.find(v => v.official) ||
      youtubeTrailers[0];
  }

  return { primaryTrailer, trailers, teasers, clips, featurettes, other };
};

const normalizeImages = (images, requestedLanguage = null) => {
  if (!images) return { primaryPoster: null, primaryBackdrop: null, posters: [], backdrops: [], logos: [] };

  const mapImg = (img) => ({
    path: img.file_path,
    url: getImageUrl(img.file_path),
    thumbnailUrl: getImageUrl(img.file_path, 'w342'),
    language: img.iso_639_1,
    width: img.width,
    height: img.height,
    aspectRatio: img.aspect_ratio,
    voteAverage: img.vote_average,
    voteCount: img.vote_count
  });

  const posters = (images.posters || []).slice(0, 50).map(mapImg);
  const backdrops = (images.backdrops || []).slice(0, 50).map(mapImg);
  const logos = (images.logos || []).slice(0, 30).map(mapImg);

  const lang = requestedLanguage ? requestedLanguage.split('-')[0] : 'vi';
  
  const primaryPoster = posters.find(p => p.language === lang) || posters.find(p => p.language === 'en') || posters.find(p => !p.language) || posters[0] || null;
  const primaryBackdrop = backdrops.find(p => !p.language) || backdrops.find(p => p.language === 'en') || backdrops[0] || null;

  return { primaryPoster, primaryBackdrop, posters, backdrops, logos };
};

const normalizeReleaseDates = (releaseDatesData, preferredCountry = 'VN') => {
  if (!releaseDatesData || !releaseDatesData.results) return { preferredCountry, preferredRelease: null, countries: [] };

  const releaseTypeMap = {
    1: 'Premiere',
    2: 'Limited Theatrical',
    3: 'Theatrical',
    4: 'Digital',
    5: 'Physical',
    6: 'TV'
  };

  const countries = releaseDatesData.results.map(country => ({
    country: country.iso_3166_1,
    releases: (country.release_dates || []).map(rd => ({
      releaseDate: rd.release_date,
      releaseType: { code: rd.type, name: releaseTypeMap[rd.type] || 'Unknown' },
      certification: rd.certification || null,
      note: rd.note || null
    }))
  }));

  let preferredRelease = null;
  const prefCountryData = countries.find(c => c.country === preferredCountry);
  if (prefCountryData && prefCountryData.releases.length > 0) {
    // Prefer theatrical (type 3)
    preferredRelease = {
      country: preferredCountry,
      ... (prefCountryData.releases.find(r => r.releaseType.code === 3) || prefCountryData.releases[0])
    };
  } else if (countries.length > 0) {
    const usData = countries.find(c => c.country === 'US');
    if (usData && usData.releases.length > 0) {
       preferredRelease = { country: 'US', ... (usData.releases.find(r => r.releaseType.code === 3) || usData.releases[0]) };
    } else {
       preferredRelease = { country: countries[0].country, ... countries[0].releases[0] };
    }
  }

  // Vietnamese Certification Mapping logic
  const vietnameseRatingRegex = /^(P|K|T13|T16|T18|C)$/;
  if (preferredRelease && preferredRelease.certification) {
     const cert = preferredRelease.certification;
     preferredRelease.sourceCertification = cert;
     preferredRelease.suggestedLoraFilmAgeRating = vietnameseRatingRegex.test(cert) ? cert : null;
     preferredRelease.requiresAdminConfirmation = true;
     delete preferredRelease.certification; // Replace with safe fields
  }

  return { preferredCountry, preferredRelease, countries };
};

const normalizeTranslations = (translationsData) => {
  if (!translationsData || !translationsData.translations) return [];
  return translationsData.translations.map(t => ({
    locale: `${t.iso_639_1}-${t.iso_3166_1}`,
    languageCode: t.iso_639_1,
    countryCode: t.iso_3166_1,
    englishLanguageName: t.english_name,
    localizedLanguageName: t.name,
    title: t.data.title || null,
    overview: t.data.overview || null,
    tagline: t.data.tagline || null,
    homepage: t.data.homepage || null,
    runtimeMinutes: t.data.runtime || null
  }));
};

const normalizeAlternativeTitles = (altTitlesData) => {
  if (!altTitlesData || !altTitlesData.titles) return [];
  return altTitlesData.titles.map(t => ({
    title: t.title,
    country: t.iso_3166_1,
    type: t.type || 'alternative title'
  }));
};

const normalizeKeywords = (keywordsData) => {
  if (!keywordsData || !keywordsData.keywords) return [];
  return keywordsData.keywords.map(k => ({
    tmdbKeywordId: k.id,
    name: k.name
  }));
};

const normalizeExternalIds = (extData) => {
  if (!extData) return {};
  return {
    tmdbId: extData.id || null,
    imdbId: extData.imdb_id || null,
    wikidataId: extData.wikidata_id || null,
    facebookId: extData.facebook_id || null,
    instagramId: extData.instagram_id || null,
    twitterId: extData.twitter_id || null
  };
};

const normalizeMoviePreview = (movie) => {
  if (!movie) return null;
  return {
    tmdbId: movie.id,
    imdbId: movie.imdb_id || null,
    title: movie.title,
    originalTitle: movie.original_title || null,
    tagline: movie.tagline || null,
    overview: movie.overview || null,
    originalLanguage: movie.original_language || null,
    spokenLanguages: (movie.spoken_languages || []).map(lang => ({
      isoCode: lang.iso_639_1,
      englishName: lang.english_name,
      name: lang.name
    })),
    countries: (movie.production_countries || []).map(c => ({
      isoCode: c.iso_3166_1,
      name: c.name
    })),
    runtimeMinutes: movie.runtime || null,
    releaseDate: movie.release_date || null,
    status: movie.status || null,
    adult: movie.adult || false,
    homepage: movie.homepage || null,
    budget: movie.budget || 0,
    revenue: movie.revenue || 0,
    popularity: movie.popularity || 0,
    voteAverage: movie.vote_average || 0,
    voteCount: movie.vote_count || 0,
    poster: {
      path: movie.poster_path || null,
      url: getImageUrl(movie.poster_path)
    },
    backdrop: {
      path: movie.backdrop_path || null,
      url: getImageUrl(movie.backdrop_path)
    },
    genres: (movie.genres || []).map(g => ({ tmdbGenreId: g.id, name: g.name })),
    productionCompanies: (movie.production_companies || []).map(company => ({
      tmdbCompanyId: company.id,
      name: company.name,
      logoUrl: getImageUrl(company.logo_path),
      originCountry: company.origin_country
    }))
  };
};

const normalizeMovieBundle = (movie, requestedLanguage) => {
  if (!movie) return null;
  
  return {
    movie: normalizeMoviePreview(movie),
    genres: (movie.genres || []).map(g => ({ tmdbGenreId: g.id, name: g.name })),
    credits: normalizeCredits(movie.credits),
    media: normalizeImages(movie.images, requestedLanguage),
    videos: normalizeVideos(movie.videos, requestedLanguage), // Exposing it as well for consistency
    releaseInfo: normalizeReleaseDates(movie.release_dates),
    translations: normalizeTranslations(movie.translations),
    alternativeTitles: normalizeAlternativeTitles(movie.alternative_titles),
    keywords: normalizeKeywords(movie.keywords),
    externalIds: normalizeExternalIds(movie.external_ids),
    productionCompanies: (movie.production_companies || []).map(company => ({
      tmdbCompanyId: company.id,
      name: company.name,
      logoUrl: getImageUrl(company.logo_path),
      originCountry: company.origin_country
    })),
    metadata: {
      provider: 'TMDB',
      language: requestedLanguage || config.tmdb.defaultLanguage,
      fallbackLanguage: config.tmdb.fallbackLanguage,
      fetchedAt: new Date().toISOString(),
      cacheHit: false // overridden in controller if needed
    }
  };
};

// =====================
// PERSON NORMALIZATION
// =====================
const normalizePersonSearchItem = (person) => {
  if (!person) return null;
  return {
    tmdbPersonId: person.id,
    name: person.name,
    originalName: person.original_name,
    knownForDepartment: person.known_for_department,
    profilePath: person.profile_path || null,
    profileUrl: getImageUrl(person.profile_path),
    popularity: person.popularity,
    knownFor: (person.known_for || []).map(k => normalizeMovieSearchItem(k))
  };
};

const normalizePersonDetail = (person) => {
  if (!person) return null;
  
  const genderMap = { 0: 'Unknown', 1: 'Female', 2: 'Male', 3: 'Non-binary' };
  
  return {
    tmdbPersonId: person.id,
    name: person.name,
    alsoKnownAs: person.also_known_as || [],
    biography: person.biography || null,
    birthday: person.birthday || null,
    deathday: person.deathday || null,
    gender: {
      code: person.gender,
      name: genderMap[person.gender] || 'Unknown'
    },
    placeOfBirth: person.place_of_birth || null,
    knownForDepartment: person.known_for_department,
    homepage: person.homepage || null,
    imdbId: person.imdb_id || null,
    profile: {
      path: person.profile_path || null,
      url: getImageUrl(person.profile_path)
    }
  };
};

// =====================
// SYNC NORMALIZATION
// =====================
const normalizeSyncMovie = (movie, qualityScore, qualityStatus) => {
  if (!movie) return null;

  const bundle = normalizeMovieBundle(movie, config.tmdb.defaultLanguage);
  
  return {
    tmdbId: movie.id,
    lastUpdated: new Date().toISOString(), // Fallback if no specific last changed date is fetched
    qualityScore,
    qualityStatus,
    ...bundle
  };
};

module.exports = {
  getImageUrl,
  normalizePagination,
  normalizeMovieSearchItem,
  normalizeCredits,
  normalizeVideos,
  normalizeImages,
  normalizeReleaseDates,
  normalizeTranslations,
  normalizeAlternativeTitles,
  normalizeKeywords,
  normalizeExternalIds,
  normalizeMoviePreview,
  normalizeMovieBundle,
  normalizePersonSearchItem,
  normalizePersonDetail,
  normalizeSyncMovie
};
