package com.callrecorder.data.db;

import android.database.Cursor;
import android.os.CancellationSignal;
import androidx.annotation.NonNull;
import androidx.room.CoroutinesRoom;
import androidx.room.EntityInsertionAdapter;
import androidx.room.RoomDatabase;
import androidx.room.RoomSQLiteQuery;
import androidx.room.SharedSQLiteStatement;
import androidx.room.util.CursorUtil;
import androidx.room.util.DBUtil;
import androidx.sqlite.db.SupportSQLiteStatement;
import java.lang.Class;
import java.lang.Exception;
import java.lang.Object;
import java.lang.Override;
import java.lang.String;
import java.lang.SuppressWarnings;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.concurrent.Callable;
import javax.annotation.processing.Generated;
import kotlin.Unit;
import kotlin.coroutines.Continuation;
import kotlinx.coroutines.flow.Flow;

@Generated("androidx.room.RoomProcessor")
@SuppressWarnings({"unchecked", "deprecation"})
public final class CrmLogDao_Impl implements CrmLogDao {
  private final RoomDatabase __db;

  private final EntityInsertionAdapter<CrmLogEntity> __insertionAdapterOfCrmLogEntity;

  private final SharedSQLiteStatement __preparedStmtOfClearAll;

  public CrmLogDao_Impl(@NonNull final RoomDatabase __db) {
    this.__db = __db;
    this.__insertionAdapterOfCrmLogEntity = new EntityInsertionAdapter<CrmLogEntity>(__db) {
      @Override
      @NonNull
      protected String createQuery() {
        return "INSERT OR ABORT INTO `crm_logs` (`id`,`timestamp`,`phoneNumber`,`callType`,`durationSecs`,`synced`,`callLogId`,`errorMessage`) VALUES (nullif(?, 0),?,?,?,?,?,?,?)";
      }

      @Override
      protected void bind(@NonNull final SupportSQLiteStatement statement,
          @NonNull final CrmLogEntity entity) {
        statement.bindLong(1, entity.getId());
        statement.bindLong(2, entity.getTimestamp());
        statement.bindString(3, entity.getPhoneNumber());
        statement.bindString(4, entity.getCallType());
        statement.bindLong(5, entity.getDurationSecs());
        final int _tmp = entity.getSynced() ? 1 : 0;
        statement.bindLong(6, _tmp);
        if (entity.getCallLogId() == null) {
          statement.bindNull(7);
        } else {
          statement.bindString(7, entity.getCallLogId());
        }
        if (entity.getErrorMessage() == null) {
          statement.bindNull(8);
        } else {
          statement.bindString(8, entity.getErrorMessage());
        }
      }
    };
    this.__preparedStmtOfClearAll = new SharedSQLiteStatement(__db) {
      @Override
      @NonNull
      public String createQuery() {
        final String _query = "DELETE FROM crm_logs";
        return _query;
      }
    };
  }

  @Override
  public Object insert(final CrmLogEntity log, final Continuation<? super Unit> $completion) {
    return CoroutinesRoom.execute(__db, true, new Callable<Unit>() {
      @Override
      @NonNull
      public Unit call() throws Exception {
        __db.beginTransaction();
        try {
          __insertionAdapterOfCrmLogEntity.insert(log);
          __db.setTransactionSuccessful();
          return Unit.INSTANCE;
        } finally {
          __db.endTransaction();
        }
      }
    }, $completion);
  }

  @Override
  public Object clearAll(final Continuation<? super Unit> $completion) {
    return CoroutinesRoom.execute(__db, true, new Callable<Unit>() {
      @Override
      @NonNull
      public Unit call() throws Exception {
        final SupportSQLiteStatement _stmt = __preparedStmtOfClearAll.acquire();
        try {
          __db.beginTransaction();
          try {
            _stmt.executeUpdateDelete();
            __db.setTransactionSuccessful();
            return Unit.INSTANCE;
          } finally {
            __db.endTransaction();
          }
        } finally {
          __preparedStmtOfClearAll.release(_stmt);
        }
      }
    }, $completion);
  }

  @Override
  public Flow<List<CrmLogEntity>> getAllLogs() {
    final String _sql = "SELECT * FROM crm_logs ORDER BY timestamp DESC LIMIT 300";
    final RoomSQLiteQuery _statement = RoomSQLiteQuery.acquire(_sql, 0);
    return CoroutinesRoom.createFlow(__db, false, new String[] {"crm_logs"}, new Callable<List<CrmLogEntity>>() {
      @Override
      @NonNull
      public List<CrmLogEntity> call() throws Exception {
        final Cursor _cursor = DBUtil.query(__db, _statement, false, null);
        try {
          final int _cursorIndexOfId = CursorUtil.getColumnIndexOrThrow(_cursor, "id");
          final int _cursorIndexOfTimestamp = CursorUtil.getColumnIndexOrThrow(_cursor, "timestamp");
          final int _cursorIndexOfPhoneNumber = CursorUtil.getColumnIndexOrThrow(_cursor, "phoneNumber");
          final int _cursorIndexOfCallType = CursorUtil.getColumnIndexOrThrow(_cursor, "callType");
          final int _cursorIndexOfDurationSecs = CursorUtil.getColumnIndexOrThrow(_cursor, "durationSecs");
          final int _cursorIndexOfSynced = CursorUtil.getColumnIndexOrThrow(_cursor, "synced");
          final int _cursorIndexOfCallLogId = CursorUtil.getColumnIndexOrThrow(_cursor, "callLogId");
          final int _cursorIndexOfErrorMessage = CursorUtil.getColumnIndexOrThrow(_cursor, "errorMessage");
          final List<CrmLogEntity> _result = new ArrayList<CrmLogEntity>(_cursor.getCount());
          while (_cursor.moveToNext()) {
            final CrmLogEntity _item;
            final int _tmpId;
            _tmpId = _cursor.getInt(_cursorIndexOfId);
            final long _tmpTimestamp;
            _tmpTimestamp = _cursor.getLong(_cursorIndexOfTimestamp);
            final String _tmpPhoneNumber;
            _tmpPhoneNumber = _cursor.getString(_cursorIndexOfPhoneNumber);
            final String _tmpCallType;
            _tmpCallType = _cursor.getString(_cursorIndexOfCallType);
            final long _tmpDurationSecs;
            _tmpDurationSecs = _cursor.getLong(_cursorIndexOfDurationSecs);
            final boolean _tmpSynced;
            final int _tmp;
            _tmp = _cursor.getInt(_cursorIndexOfSynced);
            _tmpSynced = _tmp != 0;
            final String _tmpCallLogId;
            if (_cursor.isNull(_cursorIndexOfCallLogId)) {
              _tmpCallLogId = null;
            } else {
              _tmpCallLogId = _cursor.getString(_cursorIndexOfCallLogId);
            }
            final String _tmpErrorMessage;
            if (_cursor.isNull(_cursorIndexOfErrorMessage)) {
              _tmpErrorMessage = null;
            } else {
              _tmpErrorMessage = _cursor.getString(_cursorIndexOfErrorMessage);
            }
            _item = new CrmLogEntity(_tmpId,_tmpTimestamp,_tmpPhoneNumber,_tmpCallType,_tmpDurationSecs,_tmpSynced,_tmpCallLogId,_tmpErrorMessage);
            _result.add(_item);
          }
          return _result;
        } finally {
          _cursor.close();
        }
      }

      @Override
      protected void finalize() {
        _statement.release();
      }
    });
  }

  @Override
  public Object getAllLogsSnapshot(final Continuation<? super List<CrmLogEntity>> $completion) {
    final String _sql = "SELECT * FROM crm_logs ORDER BY timestamp DESC LIMIT 300";
    final RoomSQLiteQuery _statement = RoomSQLiteQuery.acquire(_sql, 0);
    final CancellationSignal _cancellationSignal = DBUtil.createCancellationSignal();
    return CoroutinesRoom.execute(__db, false, _cancellationSignal, new Callable<List<CrmLogEntity>>() {
      @Override
      @NonNull
      public List<CrmLogEntity> call() throws Exception {
        final Cursor _cursor = DBUtil.query(__db, _statement, false, null);
        try {
          final int _cursorIndexOfId = CursorUtil.getColumnIndexOrThrow(_cursor, "id");
          final int _cursorIndexOfTimestamp = CursorUtil.getColumnIndexOrThrow(_cursor, "timestamp");
          final int _cursorIndexOfPhoneNumber = CursorUtil.getColumnIndexOrThrow(_cursor, "phoneNumber");
          final int _cursorIndexOfCallType = CursorUtil.getColumnIndexOrThrow(_cursor, "callType");
          final int _cursorIndexOfDurationSecs = CursorUtil.getColumnIndexOrThrow(_cursor, "durationSecs");
          final int _cursorIndexOfSynced = CursorUtil.getColumnIndexOrThrow(_cursor, "synced");
          final int _cursorIndexOfCallLogId = CursorUtil.getColumnIndexOrThrow(_cursor, "callLogId");
          final int _cursorIndexOfErrorMessage = CursorUtil.getColumnIndexOrThrow(_cursor, "errorMessage");
          final List<CrmLogEntity> _result = new ArrayList<CrmLogEntity>(_cursor.getCount());
          while (_cursor.moveToNext()) {
            final CrmLogEntity _item;
            final int _tmpId;
            _tmpId = _cursor.getInt(_cursorIndexOfId);
            final long _tmpTimestamp;
            _tmpTimestamp = _cursor.getLong(_cursorIndexOfTimestamp);
            final String _tmpPhoneNumber;
            _tmpPhoneNumber = _cursor.getString(_cursorIndexOfPhoneNumber);
            final String _tmpCallType;
            _tmpCallType = _cursor.getString(_cursorIndexOfCallType);
            final long _tmpDurationSecs;
            _tmpDurationSecs = _cursor.getLong(_cursorIndexOfDurationSecs);
            final boolean _tmpSynced;
            final int _tmp;
            _tmp = _cursor.getInt(_cursorIndexOfSynced);
            _tmpSynced = _tmp != 0;
            final String _tmpCallLogId;
            if (_cursor.isNull(_cursorIndexOfCallLogId)) {
              _tmpCallLogId = null;
            } else {
              _tmpCallLogId = _cursor.getString(_cursorIndexOfCallLogId);
            }
            final String _tmpErrorMessage;
            if (_cursor.isNull(_cursorIndexOfErrorMessage)) {
              _tmpErrorMessage = null;
            } else {
              _tmpErrorMessage = _cursor.getString(_cursorIndexOfErrorMessage);
            }
            _item = new CrmLogEntity(_tmpId,_tmpTimestamp,_tmpPhoneNumber,_tmpCallType,_tmpDurationSecs,_tmpSynced,_tmpCallLogId,_tmpErrorMessage);
            _result.add(_item);
          }
          return _result;
        } finally {
          _cursor.close();
          _statement.release();
        }
      }
    }, $completion);
  }

  @NonNull
  public static List<Class<?>> getRequiredConverters() {
    return Collections.emptyList();
  }
}
