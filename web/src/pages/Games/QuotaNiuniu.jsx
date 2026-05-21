/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

import React, { useEffect, useState } from 'react';
import {
  Button,
  Card,
  List,
  Modal,
  Space,
  Spin,
  Tag,
  Typography,
} from '@douyinfe/semi-ui';
import { IconCrown, IconHistory, IconRefresh } from '@douyinfe/semi-icons';
import { useTranslation } from 'react-i18next';
import { API, showError, showSuccess } from '../../helpers';
import GameQuickSwitch from '../../components/games/GameQuickSwitch';
import GameDailyLimitPanel from '../../components/games/GameDailyLimitPanel';

const { Title, Text, Paragraph } = Typography;

const lightText = { color: '#fff7ed' };
const mutedText = { color: 'rgba(255, 247, 237, 0.74)' };
const cardBodyStyle = { background: 'transparent', padding: 0 };
const controlLocked = (activeRound, settled) =>
  Boolean(activeRound && !settled);

const tableSizeLabel = (size, t) => `${size} ${t('人桌')}`;
const modeLabel = (value, t) => (value === 'grab' ? t('抢庄') : t('固庄'));

const suitMap = {
  spade: { symbol: '♠', color: '#111827', label: '黑桃' },
  heart: { symbol: '♥', color: '#b91c1c', label: '红桃' },
  club: { symbol: '♣', color: '#111827', label: '梅花' },
  diamond: { symbol: '♦', color: '#b91c1c', label: '方块' },
};

const rankMap = {
  1: 'A',
  11: 'J',
  12: 'Q',
  13: 'K',
  14: 'A',
};

const formatAmount = (value) => {
  const number = Number(value || 0);
  return number
    .toFixed(2)
    .replace(/\.00$/, '')
    .replace(/(\.\d)0$/, '$1');
};

const formatSignedAmount = (value) => {
  const number = Number(value || 0);
  const prefix = number > 0 ? '+' : '';
  return `${prefix}${formatAmount(number)}`;
};

const formatTime = (timestamp) => {
  if (!timestamp) return '-';
  return new Date(timestamp * 1000).toLocaleString();
};

const getSeats = (round) =>
  round?.seats || round?.players || round?.hands || [];
const getTableSize = (round, fallback = 5) =>
  Number(round?.table_size || round?.seat_count || fallback || 5);
const getMode = (round, fallback = 'banker') =>
  round?.mode || round?.play_mode || fallback || 'banker';
const getSeatCards = (seat) => seat?.cards || seat?.hand_cards || [];
const getSeatName = (seat, index, t) =>
  seat?.name || seat?.username || seat?.label || `${t('座位')} ${index + 1}`;
const getHandLabel = (seat) =>
  seat?.hand_type_label ||
  seat?.type_label ||
  seat?.hand?.type_label ||
  seat?.niu_label ||
  '-';
const getRoundAmount = (round) =>
  round?.payout_amount ?? round?.net_profit ?? 0;
const isBankerSeat = (seat) =>
  Boolean(seat?.is_banker || seat?.banker || seat?.role === 'banker');
const isUserSeat = (seat, index) =>
  Boolean(
    seat?.is_user || seat?.role === 'user' || seat?.seat === 0 || index === 0,
  );
const getResultLabel = (result, t) => {
  if (result === 'win') return t('胜');
  if (result === 'lose') return t('负');
  if (result === 'push') return t('平');
  return t('待定');
};

const getResultTone = (result) => {
  if (result === 'win') return 'win';
  if (result === 'lose') return 'lose';
  if (result === 'push') return 'push';
  return 'pending';
};

const getResultToneClass = (tone) => {
  if (tone === 'win')
    return 'border-emerald-200 bg-emerald-100 text-emerald-950';
  if (tone === 'lose') return 'border-rose-200 bg-rose-100 text-rose-950';
  if (tone === 'push') return 'border-amber-200 bg-amber-100 text-amber-950';
  return 'border-slate-200 bg-slate-100 text-slate-950';
};

const StatusChip = ({ children, tone = 'green' }) => {
  const toneClass =
    tone === 'orange'
      ? 'border-orange-200 bg-orange-100 text-orange-950'
      : tone === 'cyan'
        ? 'border-cyan-200 bg-cyan-100 text-cyan-950'
        : 'border-emerald-200 bg-emerald-100 text-emerald-950';

  return (
    <span
      className={`inline-flex min-h-[28px] items-center rounded-md border px-3 py-1 text-sm font-black shadow-sm ${toneClass}`}
    >
      {children}
    </span>
  );
};

const SeatBadge = ({ children, tone = 'green' }) => {
  const toneClass =
    tone === 'orange'
      ? 'border-orange-200 bg-orange-100 text-orange-950'
      : 'border-emerald-200 bg-emerald-100 text-emerald-950';

  return (
    <span
      className={`inline-flex min-h-[24px] items-center rounded-md border px-2 py-0.5 text-xs font-black shadow-sm ${toneClass}`}
    >
      {children}
    </span>
  );
};

const ResultBadge = ({ result, t, children, className = '' }) => {
  const tone = getResultTone(result);

  return (
    <span
      className={`inline-flex min-h-[30px] items-center rounded-lg border px-3 py-1 text-sm font-black shadow-sm ${getResultToneClass(tone)} ${className}`}
    >
      {children || `${t('结果')}：${getResultLabel(result, t)}`}
    </span>
  );
};

const ChoiceButton = ({
  active,
  locked,
  children,
  onClick,
  className = '',
}) => (
  <button
    className={`quota-niu-setting-button rounded-2xl border-2 px-3 py-3 text-center font-black transition ${className} ${
      active
        ? 'border-amber-50 bg-[#fff7d6] text-[#241005] shadow-[0_0_0_2px_rgba(251,191,36,0.45),0_12px_24px_rgba(0,0,0,0.28)]'
        : 'border-amber-100/80 bg-[#813016] text-[#fff7ed] hover:border-amber-50 hover:bg-[#9a3b1a]'
    } ${locked ? 'cursor-not-allowed' : 'cursor-pointer'}`}
    type='button'
    disabled={locked}
    onClick={onClick}
    aria-pressed={active}
  >
    {children}
  </button>
);

const getButtonLabelStyle = (active) => ({
  color: active ? '#241005' : '#fff7ed',
  WebkitTextFillColor: active ? '#241005' : '#fff7ed',
});

const CardFace = ({ card, hidden = false, index = 0, peekable = false }) => {
  const actuallyHidden = hidden || !card;

  if (actuallyHidden) {
    return (
      <div
        className='quota-niu-card quota-niu-card-back flex h-20 w-14 items-center justify-center rounded-xl border border-amber-100 bg-[linear-gradient(135deg,#8b1e1e,#2b0c0c)] text-lg font-black text-amber-100 shadow-lg'
        style={{ animationDelay: `${index * 70}ms` }}
      >
        ?
      </div>
    );
  }

  const suit = suitMap[card?.suit] || suitMap.spade;
  const rank = rankMap[card?.rank] || card?.rank || card?.value || '?';
  return (
    <div
      className={`quota-niu-card ${
        peekable
          ? 'quota-niu-card-peek group cursor-pointer overflow-hidden'
          : ''
      } relative flex h-20 w-14 flex-col justify-between overflow-hidden rounded-xl border-2 border-amber-100 bg-[#fffdf4] p-1.5 shadow-lg shadow-black/30`}
      style={{ animationDelay: `${index * 70}ms` }}
      tabIndex={peekable ? 0 : undefined}
      aria-label={`${suit.label}${rank}`}
    >
      <div
        className='flex items-start justify-between'
        style={{ color: suit.color }}
      >
        <span className='text-xl font-black leading-none'>{rank}</span>
        <span className='text-lg font-black leading-none'>{suit.symbol}</span>
      </div>
      <div
        className='flex flex-1 items-center justify-center text-center font-black leading-none'
        style={{ color: suit.color }}
      >
        <div className='text-4xl leading-none'>{suit.symbol}</div>
      </div>
      <div className='h-1' />
      {peekable && (
        <span
          className='quota-niu-peek-cover pointer-events-none absolute inset-0 rounded-xl border border-amber-100 bg-[linear-gradient(135deg,#8b1e1e,#2b0c0c)] shadow-inner'
          aria-hidden='true'
        />
      )}
    </div>
  );
};

const SeatPanel = ({ seat, index, settled, t }) => {
  const cards = getSeatCards(seat);
  const banker = isBankerSeat(seat);
  const user = isUserSeat(seat, index);
  const visibleCards = cards.length > 0 ? cards : [];
  const cardSlots =
    !settled && !user
      ? [...visibleCards.slice(0, 3), null, null]
      : visibleCards.length > 0
        ? visibleCards
        : [null, null, null, null, null];
  const handLabel = getHandLabel(seat);
  const showHandLabel = settled && handLabel !== '-';

  return (
    <div
      className={`relative rounded-3xl border p-4 pb-14 shadow-[0_18px_34px_rgba(0,0,0,0.24)] ${
        banker
          ? 'border-amber-200 bg-[linear-gradient(145deg,#fff4bf,#f2b84b)] text-[#2b1505]'
          : 'border-emerald-200/45 bg-[#0d3f32] text-[#fff7ed]'
      }`}
    >
      <div className='mb-3 flex items-start justify-between gap-3'>
        <div>
          <div
            className={`text-sm font-bold ${banker ? 'text-[#5f2e0e]' : 'text-emerald-100/80'}`}
          >
            {getSeatName(seat, index, t)}
          </div>
          <div
            className={`mt-2 inline-flex min-h-[34px] items-center rounded-full border px-3 py-1 text-base font-black ${
              banker
                ? 'border-amber-700/20 bg-white/80 text-[#2b1505]'
                : 'border-amber-100/75 bg-amber-100 text-[#2b1505]'
            }`}
          >
            {showHandLabel ? handLabel : t('待开牌')}
          </div>
        </div>
        <div className='flex shrink-0 flex-wrap justify-end gap-1.5'>
          {user && <SeatBadge>{t('自己')}</SeatBadge>}
          {banker && <SeatBadge tone='orange'>{t('庄家')}</SeatBadge>}
        </div>
      </div>

      <div className='flex min-h-[92px] flex-wrap gap-3'>
        {cardSlots.map((card, cardIndex) => (
          <CardFace
            key={`${card?.suit || 'x'}-${card?.rank || cardIndex}`}
            card={card}
            hidden={!card}
            index={cardIndex}
            peekable={user && !settled && Boolean(card) && cardIndex >= 3}
          />
        ))}
      </div>

      <ResultBadge
        result={seat?.result}
        t={t}
        className='absolute bottom-3 right-3'
      />
    </div>
  );
};

const QuotaNiuniu = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState(null);
  const [activeRound, setActiveRound] = useState(null);
  const [selectedBet, setSelectedBet] = useState(1);
  const [tableSize, setTableSize] = useState(5);
  const [mode, setMode] = useState('banker');
  const [acting, setActing] = useState(false);
  const [reliefClaiming, setReliefClaiming] = useState(false);
  const [historyVisible, setHistoryVisible] = useState(false);

  const loadStatus = async ({ syncActiveRound = true } = {}) => {
    setLoading(true);
    try {
      const res = await API.get('/api/games/quota-niuniu/status');
      const { success, message, data } = res.data || {};
      if (!success) {
        showError(message || t('获取游戏状态失败'));
        return;
      }
      setStatus(data);
      if (syncActiveRound) {
        const round = data?.current_round || null;
        setActiveRound(round);
        if (round) {
          setTableSize(getTableSize(round, tableSize));
          setMode(getMode(round, mode));
        }
      }
      if (!selectedBet && data?.bet_amounts?.length > 0) {
        setSelectedBet(data.bet_amounts[0]);
      }
    } catch (error) {
      showError(error);
    } finally {
      setLoading(false);
    }
  };

  const createRound = async () => {
    setActing(true);
    try {
      const res = await API.post('/api/games/quota-niuniu/rounds', {
        bet_amount: selectedBet,
        table_size: tableSize,
        mode,
      });
      const { success, message, data } = res.data || {};
      if (!success) {
        showError(message || t('开局失败'));
        return;
      }
      setActiveRound(data);
      await loadStatus({ syncActiveRound: false });
      showSuccess(t('额度斗牛已开局'));
    } catch (error) {
      showError(error);
    } finally {
      setActing(false);
    }
  };

  const settleRound = async () => {
    if (!activeRound?.id) return;
    setActing(true);
    try {
      const res = await API.post(
        `/api/games/quota-niuniu/rounds/${activeRound.id}/settle`,
      );
      const { success, message, data } = res.data || {};
      if (!success) {
        showError(message || t('结算失败'));
        return;
      }
      setActiveRound(data);
      await loadStatus({ syncActiveRound: false });
      showSuccess(t('斗牛结算完成'));
    } catch (error) {
      showError(error);
    } finally {
      setActing(false);
    }
  };

  const claimRelief = async () => {
    setReliefClaiming(true);
    try {
      const res = await API.post('/api/games/relief/claim');
      const { success, message } = res.data || {};
      if (!success) {
        showError(message || t('领取救助资金失败'));
        return;
      }
      showSuccess(t('救助资金已领取'));
      await loadStatus({ syncActiveRound: false });
    } catch (error) {
      showError(error);
    } finally {
      setReliefClaiming(false);
    }
  };

  useEffect(() => {
    loadStatus();
  }, []);

  const seats = getSeats(activeRound);
  const settled =
    activeRound?.status === 'settled' || activeRound?.status === 'completed';
  const dailyRemaining = Number(status?.daily_limit?.remaining_count ?? 1);
  const canStart =
    Number(status?.user_balance || 0) >= Number(selectedBet || 0) &&
    dailyRemaining > 0 &&
    !activeRound;
  const roundTableSize = getTableSize(activeRound, tableSize);
  const roundMode = getMode(activeRound, mode);
  const settingsLocked = controlLocked(activeRound, settled);
  const tableScrollable = roundTableSize > 3;
  const roundAmount = getRoundAmount(activeRound);

  if (loading && !status) {
    return (
      <div className='min-h-[calc(100vh-64px)] px-4 pb-10 pt-24 md:px-8'>
        <div className='mx-auto flex max-w-6xl justify-center py-20'>
          <Spin size='large' />
        </div>
      </div>
    );
  }

  return (
    <div className='min-h-[calc(100vh-64px)] bg-[radial-gradient(circle_at_20%_0%,#3b1b15_0%,#140b0a_46%,#050404_100%)] px-4 pb-10 pt-24 text-[#fff7ed] md:px-8'>
      <style>{`
        .quota-niu-card { animation: quota-niu-deal 360ms ease-out both; }
        .quota-niu-card-back {
          box-shadow: 0 12px 24px rgba(0, 0, 0, 0.46), inset 0 0 0 2px rgba(255, 244, 191, 0.22);
        }
        .quota-niu-card-peek { isolation: isolate; }
        .quota-niu-peek-cover {
          transform-origin: left bottom;
          transition:
            transform 1800ms cubic-bezier(0.19, 1, 0.22, 1),
            clip-path 1800ms cubic-bezier(0.19, 1, 0.22, 1),
            opacity 1800ms ease;
          clip-path: polygon(0 0, 100% 0, 100% 100%, 0 100%);
        }
        .quota-niu-card-peek:hover .quota-niu-peek-cover,
        .quota-niu-card-peek:focus-within .quota-niu-peek-cover {
          transform: translate(34px, -18px) rotate(16deg);
          clip-path: polygon(58% 0, 100% 0, 100% 44%, 84% 58%);
          opacity: 0.9;
        }
        @keyframes quota-niu-deal { from { opacity:0; transform:translateY(-18px) rotate(8deg); } to { opacity:1; transform:translateY(0) rotate(0); } }
        .quota-niu-setting-button:disabled {
          cursor: not-allowed;
          opacity: 1;
          filter: none;
          -webkit-text-fill-color: currentColor;
          color: inherit;
        }
        @media (prefers-reduced-motion: reduce) {
          .quota-niu-card { animation:none !important; }
          .quota-niu-peek-cover { transition: none; }
        }
      `}</style>

      <div className='mx-auto max-w-6xl'>
        <div className='mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between'>
          <div>
            <div className='mb-3 inline-flex rounded-full border border-red-200/60 bg-red-300/15 px-4 py-1 text-sm font-semibold text-red-50'>
              {t('3/5 人桌 · 固庄/抢庄 · 额度即时结算')}
            </div>
            <Title heading={2} className='!mb-2' style={lightText}>
              {t('额度斗牛')}
            </Title>
            <Paragraph className='!mb-0 max-w-2xl text-base' style={mutedText}>
              {t(
                '选择桌型、模式和入场额后发牌，系统展示每个座位的牌组、庄家标识、牌型以及最终净收益或扣款。',
              )}
            </Paragraph>
          </div>
          <Space wrap>
            <Button
              theme='solid'
              type='tertiary'
              icon={<IconHistory />}
              onClick={() => setHistoryVisible(true)}
            >
              {t('最近斗牛')}
            </Button>
            <Button
              theme='solid'
              type='tertiary'
              icon={<IconRefresh />}
              onClick={() => loadStatus()}
            >
              {t('刷新')}
            </Button>
          </Space>
        </div>

        <GameQuickSwitch currentKey='quota-niuniu' className='mb-6' />

        <GameDailyLimitPanel
          dailyLimit={status?.daily_limit}
          onClaim={claimRelief}
          claiming={reliefClaiming}
          dark
          className='mb-6 relative z-10'
        />

        <div className='grid grid-cols-1 gap-5 lg:grid-cols-3'>
          <Card
            className='overflow-hidden lg:col-span-2'
            style={{
              background:
                'linear-gradient(145deg, #176043 0%, #0e3a2d 58%, #071b16 100%)',
              border: '1px solid rgba(251, 191, 36, 0.32)',
              boxShadow: '0 24px 70px rgba(0,0,0,0.42)',
            }}
            bodyStyle={cardBodyStyle}
          >
            <div className='p-4 md:p-6'>
              <div className='mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between'>
                <div>
                  <Text style={mutedText}>{t('当前站内余额')}</Text>
                  <div className='mt-1 text-3xl font-black text-amber-200'>
                    {formatAmount(status?.user_balance)}
                  </div>
                </div>
                <Space wrap>
                  <StatusChip tone='cyan'>
                    {tableSizeLabel(roundTableSize, t)}
                  </StatusChip>
                  <StatusChip tone={roundMode === 'grab' ? 'orange' : 'green'}>
                    {roundMode === 'grab' ? t('抢庄模式') : t('固庄模式')}
                  </StatusChip>
                  {activeRound && (
                    <StatusChip tone={settled ? 'green' : 'orange'}>
                      {settled ? t('已结算') : t('待结算')}
                    </StatusChip>
                  )}
                  {activeRound && settled && (
                    <ResultBadge result={activeRound.result} t={t}>
                      {t('本局结果')}：{getResultLabel(activeRound.result, t)}{' '}
                      {formatSignedAmount(roundAmount)}
                    </ResultBadge>
                  )}
                </Space>
              </div>

              <div className='relative h-[620px] overflow-hidden rounded-[34px] border border-emerald-200/30 bg-[radial-gradient(circle_at_50%_42%,#1c7354_0%,#10442f_50%,#08241a_100%)] p-4 shadow-[inset_0_0_90px_rgba(0,0,0,0.45)]'>
                <div className='absolute inset-5 rounded-[42px] border-[12px] border-amber-800/30' />
                <div
                  className={`relative h-full ${
                    tableScrollable
                      ? 'overflow-y-auto pr-1'
                      : 'overflow-visible'
                  }`}
                >
                  {activeRound ? (
                    seats.length > 0 ? (
                      <div
                        className={`grid w-full grid-cols-1 gap-4 md:grid-cols-2 ${
                          tableScrollable
                            ? ''
                            : 'h-full auto-rows-fr content-stretch'
                        }`}
                      >
                        {seats.map((seat, index) => (
                          <SeatPanel
                            key={seat.id || index}
                            seat={seat}
                            index={index}
                            settled={settled}
                            t={t}
                          />
                        ))}
                      </div>
                    ) : (
                      <div className='flex min-h-[520px] flex-col items-center justify-center rounded-3xl border border-dashed border-amber-100/50 bg-black/20 p-10 text-center'>
                        <Title heading={4} style={lightText}>
                          {t('等待服务端返回座位牌组')}
                        </Title>
                        <Text style={mutedText}>
                          {t('当前局已创建，可以刷新或直接结算查看结果。')}
                        </Text>
                      </div>
                    )
                  ) : (
                    <div className='flex min-h-[520px] flex-col items-center justify-center rounded-3xl border border-dashed border-amber-100/50 bg-black/20 p-10 text-center'>
                      <IconCrown className='mb-4 text-5xl text-amber-200' />
                      <Title heading={4} style={lightText}>
                        {t('选择桌型和入场额开始斗牛')}
                      </Title>
                      <Text style={mutedText}>
                        {t(
                          '开局后会生成座位牌组，结算后展示牌型、净收益和扣款。',
                        )}
                      </Text>
                    </div>
                  )}
                </div>
              </div>

              <div className='mt-5 grid grid-cols-1 gap-3 md:grid-cols-2'>
                {activeRound && !settled ? (
                  <Button
                    size='large'
                    theme='solid'
                    type='warning'
                    loading={acting}
                    disabled={activeRound?.can_settle === false}
                    onClick={settleRound}
                  >
                    {t('立即摊牌结算')}
                  </Button>
                ) : (
                  <Button
                    size='large'
                    theme='solid'
                    type='warning'
                    loading={acting}
                    disabled={!canStart && !settled}
                    onClick={createRound}
                  >
                    {activeRound ? t('再开一桌') : t('开始斗牛')}
                  </Button>
                )}
                <Button
                  size='large'
                  theme='solid'
                  type='tertiary'
                  onClick={() => loadStatus()}
                >
                  {t('刷新桌面')}
                </Button>
              </div>
            </div>
          </Card>

          <Card
            className='overflow-hidden'
            style={{
              background:
                'linear-gradient(160deg, #7a2f14 0%, #4a1a0b 55%, #210806 100%)',
              border: '1px solid rgba(251, 191, 36, 0.72)',
              boxShadow: '0 24px 70px rgba(0,0,0,0.34)',
            }}
            bodyStyle={cardBodyStyle}
          >
            <div className='p-5 md:p-6'>
              <Title heading={4} style={lightText}>
                {t('开桌设置')}
              </Title>
              <Paragraph style={{ color: '#ffedd5', fontWeight: 700 }}>
                {t('支持 3 人桌和 5 人桌，模式支持固庄与抢庄。')}
              </Paragraph>
              <div className='mb-4 rounded-xl border border-amber-100/40 bg-[#fff7d6] px-3 py-2 text-sm font-black text-[#241005]'>
                {tableSizeLabel(tableSize, t)} · {modeLabel(mode, t)} ·{' '}
                {formatAmount(selectedBet)}
                {t('入场额')}
              </div>

              <div className='mb-5 rounded-2xl border border-amber-100/20 bg-black/30 p-3'>
                <Text strong style={lightText}>
                  {t('桌型')}
                </Text>
                <div className='mt-3 grid grid-cols-2 gap-3'>
                  {[3, 5].map((size) => (
                    <ChoiceButton
                      key={size}
                      active={Number(tableSize) === Number(size)}
                      locked={settingsLocked}
                      onClick={() => setTableSize(size)}
                      className='text-sm'
                    >
                      {tableSizeLabel(size, t)}
                    </ChoiceButton>
                  ))}
                </div>
              </div>

              <div className='mb-5 rounded-2xl border border-amber-100/20 bg-black/30 p-3'>
                <Text strong style={lightText}>
                  {t('模式')}
                </Text>
                <div className='mt-3 grid grid-cols-2 gap-3'>
                  {[
                    { value: 'banker', label: '固庄' },
                    { value: 'grab', label: '抢庄' },
                  ].map((item) => (
                    <ChoiceButton
                      key={item.value}
                      active={mode === item.value}
                      locked={settingsLocked}
                      onClick={() => setMode(item.value)}
                      className='text-sm'
                    >
                      {t(item.label)}
                    </ChoiceButton>
                  ))}
                </div>
              </div>

              <div className='grid grid-cols-3 gap-3'>
                {(status?.bet_amounts || [1, 5, 10]).map((amount) => {
                  const active = Number(selectedBet) === Number(amount);
                  return (
                    <ChoiceButton
                      key={amount}
                      active={active}
                      locked={settingsLocked}
                      onClick={() => setSelectedBet(amount)}
                      className='min-h-[76px]'
                    >
                      <span
                        className='block text-2xl font-black'
                        style={getButtonLabelStyle(active)}
                      >
                        {amount}
                      </span>
                      <span
                        className='text-xs font-bold'
                        style={getButtonLabelStyle(active)}
                      >
                        {t('入场额')}
                      </span>
                    </ChoiceButton>
                  );
                })}
              </div>
              <div className='mt-5 space-y-2'>
                {(
                  status?.rules || [
                    '开局会扣除入场额，最终按庄闲输赢计算净收益或扣款。',
                    '抢庄模式由服务端决定庄家，固庄模式按规则固定庄位。',
                    '牌型、倍率和结算金额以服务端返回为准。',
                  ]
                ).map((rule, index) => (
                  <div
                    key={rule}
                    className='rounded-xl border border-amber-100/30 bg-[#2a0d06] px-3 py-2 text-sm font-bold leading-6 text-[#fff7ed] shadow-inner shadow-black/20'
                  >
                    {index + 1}. {t(rule)}
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>

        <Modal
          title={t('最近斗牛')}
          visible={historyVisible}
          onCancel={() => setHistoryVisible(false)}
          footer={null}
          bodyStyle={{
            maxHeight: 'min(560px, calc(100vh - 260px))',
            overflowY: 'auto',
          }}
        >
          <List
            dataSource={status?.recent_rounds || []}
            emptyContent={t('暂无斗牛记录')}
            renderItem={(round) => (
              <List.Item
                main={
                  <div className='flex items-center justify-between gap-3'>
                    <div>
                      <Text strong>
                        {formatAmount(round.bet_amount)} · {getTableSize(round)}{' '}
                        {t('人桌')} ·{' '}
                        {getMode(round) === 'grab' ? t('抢庄') : t('固庄')}
                      </Text>
                      <div className='text-sm text-semi-color-text-2'>
                        {formatTime(round.created_at)}
                      </div>
                    </div>
                    <Tag
                      color={
                        round.status === 'playing'
                          ? 'orange'
                          : round.result === 'win'
                            ? 'green'
                            : 'red'
                      }
                    >
                      {round.status === 'playing'
                        ? t('待结算')
                        : formatSignedAmount(getRoundAmount(round))}
                    </Tag>
                  </div>
                }
              />
            )}
          />
        </Modal>
      </div>
    </div>
  );
};

export default QuotaNiuniu;
