'use client';

import React from 'react';
import { useBible } from '@/context/BibleContext';
import BibleStudyModal from './BibleStudyModal';

export default function BibleStudyModalWrapper() {
    const { isStudyOpen, closeStudy } = useBible();
    return isStudyOpen ? <BibleStudyModal onClose={closeStudy} /> : null;
}
