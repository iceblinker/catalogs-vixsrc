const parseReleaseInfo = (filename) => {
    if (!filename) return {};

    const name = filename.toUpperCase();
    const info = {
        quality: 'HD',
        codec: '',
        audio: [],
        visual: [],
        languages: []
    };

    // Quality
    if (name.includes('BLURAY') || name.includes('BD')) info.quality = 'BluRay';
    else if (name.includes('WEB-DL') || name.includes('WEBDL')) info.quality = 'WebDL';
    else if (name.includes('WEBRIP')) info.quality = 'WebRip';
    else if (name.includes('HDRIP')) info.quality = 'HDRip';
    else if (name.includes('DVDRIP')) info.quality = 'DVDRip';
    else if (name.includes('CAM')) info.quality = 'Cam';
    else if (name.includes('TS') || name.includes('TELESYNC')) info.quality = 'TeleSync';

    // Codec
    if (name.includes('X265') || name.includes('H265') || name.includes('HEVC')) info.codec = 'HEVC';
    else if (name.includes('X264') || name.includes('H264') || name.includes('AVC')) info.codec = 'AVC';
    else if (name.includes('AV1')) info.codec = 'AV1';
    else if (name.includes('XVID')) info.codec = 'XviD';

    // Visual Tags
    if (name.includes('HDR') || name.includes('HDR10')) info.visual.push('HDR');
    if (name.includes('DV') || name.includes('DOLBY VISION')) info.visual.push('DV');
    if (name.includes('10BIT') || name.includes('10-BIT')) info.visual.push('10bit');
    if (name.includes('IMAX')) info.visual.push('IMAX');
    if (name.includes('AI UPSCALED') || name.includes('UPSCALED')) info.visual.push('AI');

    // Audio Tags
    if (name.includes('ATMOS')) info.audio.push('Atmos');
    if (name.includes('TRUEHD')) info.audio.push('TrueHD');
    if (name.includes('DTS-HD') || name.includes('DTSHD')) info.audio.push('DTS-HD');
    if (name.includes('DTS')) info.audio.push('DTS');
    if (name.includes('AC3') || name.includes('DD5.1') || name.includes('5.1')) info.audio.push('5.1');
    if (name.includes('7.1')) info.audio.push('7.1');
    if (name.includes('AAC')) info.audio.push('AAC');
    if (name.includes('EAC3') || name.includes('DDP')) info.audio.push('E-AC3');

    // Languages
    if (name.includes('ITA') || name.includes('ITALIAN')) info.languages.push('🇮🇹 ITA');
    if (name.includes('ENG') || name.includes('ENGLISH')) info.languages.push('🇬🇧 ENG');
    if (name.includes('MULTI')) info.languages.push('🌐 MULTI');
    if (name.includes('JAP') || name.includes('JAPANESE')) info.languages.push('🇯🇵 JAP');

    return info;
};

module.exports = { parseReleaseInfo };
