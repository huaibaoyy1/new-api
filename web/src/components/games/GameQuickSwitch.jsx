import React, { useContext, useMemo } from 'react';
import { Button, Space } from '@douyinfe/semi-ui';
import { IconForward } from '@douyinfe/semi-icons';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { StatusContext } from '../../context/Status';
import { gamesRegistry } from './gamesRegistry';

const themeClassMap = {
  'magic-cube':
    '!border-amber-300/80 !bg-[linear-gradient(135deg,#fff7cc_0%,#f6c453_100%)] hover:!bg-[linear-gradient(135deg,#fff1a8_0%,#f59e0b_100%)]',
  'golden-poker':
    '!border-emerald-300/70 !bg-[linear-gradient(135deg,#d9f99d_0%,#34d399_100%)] hover:!bg-[linear-gradient(135deg,#bef264_0%,#10b981_100%)]',
  'quota-treasure':
    '!border-cyan-300/80 !bg-[linear-gradient(135deg,#cffafe_0%,#38bdf8_100%)] hover:!bg-[linear-gradient(135deg,#a5f3fc_0%,#0ea5e9_100%)]',
};

const GameQuickSwitch = ({ currentKey, className = '' }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [statusState] = useContext(StatusContext);

  const games = useMemo(
    () =>
      gamesRegistry.filter(
        (game) =>
          game.key !== currentKey &&
          statusState?.status?.[game.enabledField] === true,
      ),
    [currentKey, statusState?.status],
  );

  if (games.length === 0) {
    return null;
  }

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      <span className='rounded-full border border-white/55 bg-white/95 px-3 py-1 text-xs font-black tracking-wide text-slate-950 shadow-[0_8px_18px_rgba(0,0,0,0.22)]'>
        {t('切换游戏')}
      </span>
      <Space wrap>
        {games.map((game) => (
          <Button
            key={game.key}
            icon={<IconForward />}
            className={`!h-auto !rounded-2xl !border px-3 py-2 text-left shadow-[0_10px_24px_rgba(0,0,0,0.18)] ${
              themeClassMap[game.key] || 'border-semi-color-border'
            }`}
            onClick={() => navigate(game.path)}
          >
            <div className='flex max-w-[210px] flex-col leading-5'>
              <span className='text-sm font-black text-slate-950'>
                {t(game.title)}
              </span>
              <span className='truncate text-xs font-semibold text-slate-800'>
                {t(game.description)}
              </span>
            </div>
          </Button>
        ))}
      </Space>
    </div>
  );
};

export default GameQuickSwitch;
